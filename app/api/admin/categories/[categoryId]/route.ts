import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { adminCategorySchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { canHardDeleteCategory } from "@/lib/catalog-policy";
import { deleteStoredImage } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const parsed = adminCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid category");
  const { categoryId } = await params;
  try {
    const existing = await db.productCategory.findFirst({ where: { id: categoryId, storeId: store.id }, select: { status: true, slug: true, legacySlugs: true } });
    if (!existing) return jsonError("Category not found", 404);
    const collision = await db.productCategory.findFirst({
      where: { storeId: store.id, id: { not: categoryId }, OR: [{ slug: parsed.data.slug }, { legacySlugs: { has: parsed.data.slug } }] },
      select: { id: true },
    });
    if (collision) return jsonError("That category slug is already in use", 409);
    const legacySlugs = existing.slug === parsed.data.slug
      ? existing.legacySlugs
      : Array.from(new Set([...existing.legacySlugs, existing.slug])).filter(slug => slug !== parsed.data.slug);
    const categoryData = {
      ...parsed.data,
      legacySlugs,
      ctaHref: parsed.data.ctaHref === `/shop?category=${existing.slug}` ? `/shop?category=${parsed.data.slug}` : parsed.data.ctaHref,
      finalCtaHref: parsed.data.finalCtaHref === `/shop?category=${existing.slug}` ? `/shop?category=${parsed.data.slug}` : parsed.data.finalCtaHref,
    };
    const next = parsed.data.status;
    const action = existing.status === next ? "CATEGORY_UPDATED" : next === "PUBLISHED" ? "CATEGORY_PUBLISHED" : next === "HIDDEN" ? "CATEGORY_HIDDEN" : next === "ARCHIVED" ? "CATEGORY_ARCHIVED" : "CATEGORY_DRAFTED";
    await db.$transaction([
      db.productCategory.update({ where: { id: categoryId }, data: categoryData }),
      db.contentPage.upsert({ where: { categoryId }, update: { slug: parsed.data.slug, name: parsed.data.name, status: parsed.data.status, sortOrder: parsed.data.sortOrder, seoTitle: parsed.data.seoTitle, seoDescription: parsed.data.seoDescription, ogImageUrl: parsed.data.ogImageUrl, canonicalUrl: parsed.data.canonicalUrl, indexable: parsed.data.indexable }, create: { id: categoryId, storeId: store.id, categoryId, kind: "CATEGORY", slug: parsed.data.slug, name: parsed.data.name, status: parsed.data.status, sortOrder: parsed.data.sortOrder, defaultLocale: store.defaultLocale, seoTitle: parsed.data.seoTitle, seoDescription: parsed.data.seoDescription, ogImageUrl: parsed.data.ogImageUrl, canonicalUrl: parsed.data.canonicalUrl, indexable: parsed.data.indexable } }),
      db.auditLog.create({ data: { actorId: user.id, storeId: store.id, action, entityType: "ProductCategory", entityId: categoryId, metadata: { fromStatus: existing.status, toStatus: next, fromSlug: existing.slug, toSlug: parsed.data.slug } } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("That category slug is already in use", 409);
    return jsonError("Category could not be updated", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || context.user.role !== "ADMIN") return jsonError("Administrator access required", 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.confirmation !== "string") return jsonError("Type the category name to confirm deletion", 400);
  const { categoryId } = await params;
  const category = await db.productCategory.findFirst({
    where: { id: categoryId, storeId: context.store.id },
    select: { id: true, name: true, slug: true, images: { select: { storageKey: true } }, contentPage: { select: { id: true } }, _count: { select: { products: true } } },
  });
  if (!category) return jsonError("Category not found", 404);
  if (body.confirmation !== category.name) return jsonError("The category name does not match", 400);
  if (!canHardDeleteCategory(category._count.products)) return jsonError("Move or unassign products before deleting this category", 409);
  try {
    await db.$transaction(async tx => {
      if (category.contentPage) await tx.contentPage.delete({ where: { id: category.contentPage.id } });
      await tx.productCategory.delete({ where: { id: category.id } });
      await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CATEGORY_DELETED", entityType: "ProductCategory", entityId: category.id, metadata: { name: category.name, slug: category.slug } } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return jsonError("This category is still referenced and cannot be deleted", 409);
    return jsonError("Category could not be deleted", 500);
  }
  await Promise.all(category.images.map(image => deleteStoredImage(image.storageKey).catch(() => undefined)));
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/faq");
  revalidatePath(`/${category.slug}`);
  revalidatePath("/admin/categories");
  return NextResponse.json({ ok: true });
}
