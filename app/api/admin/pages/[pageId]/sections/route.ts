import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { validateLandingSections } from "@/lib/landing-sections";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  let sections; try { sections = validateLandingSections((await request.json()).sections); } catch { return jsonError("One or more landing sections are invalid"); }
  const { pageId } = await params; const page = await db.contentPage.findFirst({ where: { id: pageId, storeId: context.store.id, categoryId: null }, select: { id: true } }); if (!page) return jsonError("Page not found", 404);
  await db.$transaction(async tx => { await tx.landingPageSection.deleteMany({ where: { pageId, storeId: context.store.id } }); if (sections.length) await tx.landingPageSection.createMany({ data: sections.map((section, sortOrder) => ({ storeId: context.store.id, pageId, type: section.type, name: section.name, visible: section.visible, sortOrder, content: section.content as Prisma.InputJsonValue })) }); await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CONTENT_PAGE_SECTIONS_UPDATED", entityType: "ContentPage", entityId: pageId, metadata: { sectionCount: sections.length } } }); });
  return NextResponse.json({ ok: true });
}
