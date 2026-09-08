import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiUser } from "@/lib/admin";
import { adminCategorySchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const parsed = adminCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid category");
  const { categoryId } = await params;
  try {
    const updated = await db.productCategory.updateMany({ where: { id: categoryId }, data: parsed.data });
    if (!updated.count) return jsonError("Category not found", 404);
    await db.auditLog.create({ data: { actorId: user.id, action: "CATEGORY_UPDATED", entityType: "ProductCategory", entityId: categoryId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("That category slug is already in use", 409);
    return jsonError("Category could not be updated", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const { categoryId } = await params;
  const updated = await db.productCategory.updateMany({ where: { id: categoryId }, data: { active: false } });
  if (!updated.count) return jsonError("Category not found", 404);
  await db.auditLog.create({ data: { actorId: user.id, action: "CATEGORY_ARCHIVED", entityType: "ProductCategory", entityId: categoryId } });
  return NextResponse.json({ ok: true });
}
