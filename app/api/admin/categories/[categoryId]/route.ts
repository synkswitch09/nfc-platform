import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { adminCategorySchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

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
