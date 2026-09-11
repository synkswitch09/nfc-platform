import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { validateLandingSections } from "@/lib/landing-sections";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { categoryId } = await params;
  let sections;
  try { sections = validateLandingSections((await request.json()).sections); }
  catch { return jsonError("One or more landing sections are invalid"); }
  const category = await db.productCategory.findFirst({ where: { id: categoryId, storeId: context.store.id }, select: { id: true } });
  if (!category) return jsonError("Category not found", 404);
  await db.$transaction(async tx => {
    await tx.landingPageSection.deleteMany({ where: { categoryId, storeId: context.store.id } });
    if (sections.length) await tx.landingPageSection.createMany({ data: sections.map((section, sortOrder) => ({ storeId: context.store.id, categoryId, type: section.type, name: section.name, visible: section.visible, sortOrder, content: section.content as Prisma.InputJsonValue })) });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CATEGORY_LANDING_SECTIONS_UPDATED", entityType: "ProductCategory", entityId: categoryId, metadata: { sectionCount: sections.length } } });
  });
  return NextResponse.json({ ok: true });
}
