import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { resolveLocale } from "@/lib/i18n";
import { validateLandingSections } from "@/lib/landing-sections";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ pageId: string; locale: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  let sections; try { sections = validateLandingSections((await request.json()).sections); } catch { return jsonError("One or more localized sections are invalid"); }
  const { pageId, locale: requestedLocale } = await params; const locale = resolveLocale(requestedLocale, context.store.enabledLocales, context.store.defaultLocale);
  if (locale !== requestedLocale || locale === context.store.defaultLocale) return jsonError("Locale is not enabled for translation", 409);
  const base = await db.landingPageSection.findMany({ where: { pageId, storeId: context.store.id }, select: { id: true, type: true }, orderBy: { sortOrder: "asc" } });
  if (base.length !== sections.length || base.some((item, index) => item.id !== sections[index]?.id || item.type !== sections[index]?.type)) return jsonError("Localized sections must preserve the default locale structure", 409);
  await db.$transaction([...sections.map(section => db.landingPageSectionTranslation.upsert({ where: { sectionId_locale: { sectionId: section.id!, locale } }, create: { sectionId: section.id!, locale, content: section.content as Prisma.InputJsonValue }, update: { content: section.content as Prisma.InputJsonValue } })), db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CONTENT_PAGE_SECTION_TRANSLATIONS_UPDATED", entityType: "ContentPage", entityId: pageId, metadata: { locale, sectionCount: sections.length } } })]);
  return NextResponse.json({ ok: true });
}
