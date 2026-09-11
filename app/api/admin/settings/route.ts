import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

import { StoreCapability, StoreStatus } from "@prisma/client";

const url = z.string().trim().url().refine(value => /^https:\/\//i.test(value), "Use an HTTPS URL").or(z.literal(""));
const colour = z.string().regex(/^#[0-9a-f]{6}$/i);
const homepage = z.object({ heroEyebrow: z.string().trim().min(2).max(100), heroHeadline: z.string().trim().min(5).max(180), heroDescription: z.string().trim().min(10).max(360), primaryCtaLabel: z.string().trim().min(2).max(50), primaryCtaHref: z.string().regex(/^\/(?!\/)/) });
const schema = z.object({
  storeName: z.string().trim().min(2).max(100), businessName: z.string().trim().max(150).optional(), supportEmail: z.string().trim().email(),
  currency: z.string().regex(/^[A-Z]{3}$/), defaultCountry: z.string().regex(/^[A-Z]{2}$/), timezone: z.string().trim().min(3).max(80),
  logoUrl: url.optional(), faviconUrl: url.optional(), siteTitle: z.string().trim().min(5).max(70), siteDescription: z.string().trim().min(20).max(170), defaultSocialImageUrl: url.optional(),
  instagram: url.optional(), facebook: url.optional(), tiktok: url.optional(), linkedin: url.optional(), flatRateCents: z.number().int().min(0).max(100_000), freeOverCents: z.number().int().min(0).max(10_000_000),
  theme: z.object({ accent: colour, accentSecondary: colour, background: colour, foreground: colour, radius: z.string().regex(/^\d+(?:\.\d+)?(?:px|rem)$/), fontStyle: z.enum(["editorial", "modern", "technical"]) }),
  homepage,
  status: z.nativeEnum(StoreStatus).optional(), capabilities: z.array(z.nativeEnum(StoreCapability)).max(Object.values(StoreCapability).length).optional(),
}).superRefine((value, context) => { if (value.capabilities?.includes(StoreCapability.NFC) && !value.capabilities.includes(StoreCapability.DIGITAL_PROFILE)) context.addIssue({ code: "custom", path: ["capabilities"], message: "NFC requires the DIGITAL_PROFILE capability" }); });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context || !canManageStore(context)) return jsonError("Store administrator access required", 403); const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid store settings");
  const value = parsed.data;
  const removingNfc = store.capabilities.includes(StoreCapability.NFC) && value.capabilities && !value.capabilities.includes(StoreCapability.NFC);
  if (removingNfc && await db.nFCTag.count({ where: { storeId: store.id } })) return jsonError("NFC cannot be disabled while this store has issued tags", 409);
  const platformData = context.isPlatformAdmin ? { status: value.status, capabilities: value.capabilities } : {};
  await db.$transaction([
    db.store.update({ where: { id: store.id }, data: { displayName: value.storeName, legalName: value.businessName || null, supportEmail: value.supportEmail, currency: value.currency, country: value.defaultCountry, timezone: value.timezone, logoUrl: value.logoUrl || null, faviconUrl: value.faviconUrl || null, seoTitle: value.siteTitle, seoDescription: value.siteDescription, socialImageUrl: value.defaultSocialImageUrl || null, socialLinks: { instagram: value.instagram || null, facebook: value.facebook || null, tiktok: value.tiktok || null, linkedin: value.linkedin || null }, shippingConfig: { flatRateCents: value.flatRateCents, freeOverCents: value.freeOverCents }, theme: value.theme, homepage: { ...store.homepage, ...value.homepage }, ...platformData } }),
    db.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "STORE_SETTINGS_UPDATED", entityType: "Store", entityId: store.id, metadata: { status: platformData.status ?? store.status, capabilitiesChanged: Boolean(platformData.capabilities) } } }),
  ]);
  return NextResponse.json({ ok: true });
}
