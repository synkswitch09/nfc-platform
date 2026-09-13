import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { resolveLocale } from "@/lib/i18n";

const schema = z.object({ name: z.string().trim().max(140), seoTitle: z.string().trim().max(70), seoDescription: z.string().trim().max(170) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ pageId: string; locale: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid translation");
  const { pageId, locale: requestedLocale } = await params; const locale = resolveLocale(requestedLocale, context.store.enabledLocales, context.store.defaultLocale);
  if (locale !== requestedLocale || locale === context.store.defaultLocale) return jsonError("Locale is not enabled for translation", 409);
  const page = await db.contentPage.findFirst({ where: { id: pageId, storeId: context.store.id }, select: { id: true } }); if (!page) return jsonError("Page not found", 404);
  await db.$transaction([db.contentPageTranslation.upsert({ where: { pageId_locale: { pageId, locale } }, create: { pageId, locale, name: parsed.data.name || null, seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null }, update: { name: parsed.data.name || null, seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null } }), db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CONTENT_PAGE_TRANSLATION_UPDATED", entityType: "ContentPage", entityId: pageId, metadata: { locale } } })]);
  return NextResponse.json({ ok: true });
}
