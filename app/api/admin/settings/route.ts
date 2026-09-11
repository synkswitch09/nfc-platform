import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const url = z.string().trim().url().refine(value => /^https?:\/\//i.test(value)).or(z.literal(""));
const schema = z.object({ storeName: z.string().trim().min(2).max(100), businessName: z.string().trim().max(150).optional(), supportEmail: z.string().trim().email(), currency: z.literal("AUD"), defaultCountry: z.literal("AU"), siteTitle: z.string().trim().min(5).max(70), siteDescription: z.string().trim().min(20).max(170), defaultSocialImageUrl: url.optional(), instagram: url.optional(), facebook: url.optional(), tiktok: url.optional(), flatRateCents: z.number().int().min(0).max(100_000), freeOverCents: z.number().int().min(0).max(10_000_000) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context || context.user.role !== "ADMIN") return jsonError("Administrator access required", 403); const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid store settings");
  const value = parsed.data;
  await db.$transaction([
    db.store.update({ where: { id: store.id }, data: { displayName: value.storeName, legalName: value.businessName || null, supportEmail: value.supportEmail, currency: value.currency, country: value.defaultCountry, seoTitle: value.siteTitle, seoDescription: value.siteDescription, socialImageUrl: value.defaultSocialImageUrl || null, socialLinks: { instagram: value.instagram || null, facebook: value.facebook || null, tiktok: value.tiktok || null }, shippingConfig: { flatRateCents: value.flatRateCents, freeOverCents: value.freeOverCents } } }),
    db.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "STORE_SETTINGS_UPDATED", entityType: "Store", entityId: store.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
