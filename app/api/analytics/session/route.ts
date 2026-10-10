import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getCurrentStorefront } from "@/lib/storefront";
import { getRuntimeConfig } from "@/lib/config";
import { parseIntegrationConfig } from "@/lib/integration-config";
import { parsePrivacyPreferences, privacyCookieName } from "@/lib/privacy-preferences";
import { currentMeasurementSession, measurementAvailability, measurementCookie } from "@/lib/measurement";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
const schema = z.object({ clientId: z.string().regex(/^\d{1,10}\.\d{1,10}$/), fbp: z.string().regex(/^fb\.\d\.\d{10,16}\.\d{1,30}$/).optional(), fbc: z.string().regex(/^fb\.\d\.\d{10,16}\.[A-Za-z0-9_-]{1,250}$/).optional() });
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid origin", 403);
  if (getRuntimeConfig().appEnv !== "production") return jsonError("Measurement is disabled in this environment", 404);
  const store = await getCurrentStorefront();
  if (!(await rateLimit("measurement-session", getClientIp(request), 120, 3600_000)).allowed) return jsonError("Too many requests", 429);
  const preferences = parsePrivacyPreferences(request.cookies.get(privacyCookieName(store.slug))?.value);
  const existing = await currentMeasurementSession(request, store);
  const config = parseIntegrationConfig(store.integrations);
  const available = measurementAvailability(store.slug, config);
  const analytics = Boolean(preferences?.analytics && available.ga4);
  const advertising = Boolean(preferences?.advertising && (available.pixel || available.capi));
  if (!analytics && !advertising) {
    if (existing) await db.measurementSession.update({ where: { id: existing.id }, data: { analytics: false, advertising: false, fbp: null, fbc: null, clientUserAgent: null } });
    const response = NextResponse.json({ ok: true, enabled: false });
    response.headers.set("cache-control", "no-store"); return response;
  }
  const text = await request.text();
  if (text.length > 1024) return jsonError("Request too large", 413);
  const parsed = schema.safeParse((() => { try { return JSON.parse(text); } catch { return null; } })());
  if (!parsed.success) return jsonError("Invalid identifiers", 400);
  const expiresAt = new Date(Math.min(preferences!.savedAt + 365 * 86_400_000, (existing?.createdAt ?? new Date()).getTime() + 90 * 86_400_000));
  const userAgent = request.headers.get("user-agent") ?? "";
  const safeAgent = /^[\x20-\x7E]{1,512}$/.test(userAgent) && !/@|https?:\/\//i.test(userAgent) ? userAgent : null;
  const fbpCookie = request.cookies.get("_fbp")?.value;
  const fbcCookie = request.cookies.get("_fbc")?.value;
  const fbp = schema.shape.fbp.safeParse(fbpCookie);
  const fbc = schema.shape.fbc.safeParse(fbcCookie);
  const data = { analytics, advertising, expiresAt, clientUserAgent: advertising ? safeAgent : null, fbp: advertising ? (fbp.success ? fbp.data : undefined) ?? parsed.data.fbp ?? existing?.fbp ?? null : null, fbc: advertising ? (fbc.success ? fbc.data : undefined) ?? parsed.data.fbc ?? existing?.fbc ?? null : null };
  const token = existing ? null : randomBytes(32).toString("hex");
  if (existing) await db.measurementSession.update({ where: { id: existing.id }, data: { ...data, ...(Date.now() - existing.updatedAt.getTime() > 30 * 60_000 ? { sessionId: String(Math.floor(Date.now() / 1000)) } : {}) } });
  else await db.measurementSession.create({ data: { ...data, tokenHash: sha256(token!), storeId: store.id, clientId: parsed.data.clientId, sessionId: String(Math.floor(Date.now() / 1000)) } });
  const response = NextResponse.json({ ok: true, enabled: true });
  response.headers.set("cache-control", "no-store");
  if (token) response.cookies.set(measurementCookie(store.slug), token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 90 * 86400 });
  return response;
}
