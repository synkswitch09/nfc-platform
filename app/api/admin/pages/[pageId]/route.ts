import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { contentPageSchema } from "@/lib/content-page-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { revalidatePath } from "next/cache";
import { validCanonicalOverride } from "@/lib/seo";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  if (!assertSameOrigin(request))
    return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  const parsed = contentPageSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid page");
  if (!validCanonicalOverride(parsed.data.canonicalUrl, context.store.origin)) return jsonError("Canonical URL must belong to this store and contain no query or fragment", 400);
  const { pageId } = await params;
  const existing = await db.contentPage.findFirst({
    where: { id: pageId, storeId: context.store.id, categoryId: null },
  });
  if (!existing) return jsonError("Page not found", 404);
  if (["faq", "terms", "privacy"].includes(existing.slug) && parsed.data.slug !== existing.slug) return jsonError("This public page has a fixed address", 409);
  if (await db.productCategory.count({ where: { storeId: context.store.id, OR: [{ slug: parsed.data.slug }, { legacySlugs: { has: parsed.data.slug } }] } })) return jsonError("That slug is already used by a category", 409);
  if (await db.contentPage.count({ where: { storeId: context.store.id, id: { not: pageId }, OR: [{ slug: parsed.data.slug }, { legacySlugs: { has: parsed.data.slug } }] } })) return jsonError("That page slug is already in use", 409);
  if (existing.kind === "HOME" && parsed.data.kind !== "HOME")
    return jsonError("The Store Home page type cannot be changed");
  try {
    await db.$transaction([
      db.contentPage.update({
        where: { id: pageId },
        data: {
          ...parsed.data,
          legacySlugs: parsed.data.slug === existing.slug ? existing.legacySlugs : [...new Set([...existing.legacySlugs, existing.slug])].filter(slug => slug !== parsed.data.slug),
          kind: existing.kind,
          seoTitle: parsed.data.seoTitle || null,
          seoDescription: parsed.data.seoDescription || null,
          ogImageUrl: parsed.data.ogImageUrl || null,
          canonicalUrl: parsed.data.canonicalUrl || null,
        },
      }),
      db.auditLog.create({
        data: {
          actorId: context.user.id,
          storeId: context.store.id,
          action: "CONTENT_PAGE_UPDATED",
          entityType: "ContentPage",
          entityId: pageId,
          metadata: {
            kind: existing.kind,
            slug: parsed.data.slug,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);
    revalidatePath(existing.kind === "HOME" ? "/" : `/${parsed.data.slug}`);
    if (existing.slug !== parsed.data.slug && existing.kind !== "HOME")
      revalidatePath(`/${existing.slug}`);
    revalidatePath(`/admin/pages/${pageId}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
        ? "That page slug is already in use"
        : "Page could not be updated",
      409,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  if (!assertSameOrigin(request))
    return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  const { pageId } = await params;
  const existing = await db.contentPage.findFirst({
    where: { id: pageId, storeId: context.store.id, categoryId: null },
  });
  if (!existing) return jsonError("Page not found", 404);
  if (existing.kind === "HOME")
    return jsonError("The Store Home page cannot be deleted", 409);
  if (existing.status === "PUBLISHED")
    return jsonError("Archive or hide this page before deleting it", 409);
  await db.$transaction([
    db.contentPage.delete({ where: { id: pageId } }),
    db.auditLog.create({
      data: {
        actorId: context.user.id,
        storeId: context.store.id,
        action: "CONTENT_PAGE_DELETED",
        entityType: "ContentPage",
        entityId: pageId,
        metadata: {
          kind: existing.kind,
          slug: existing.slug,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);
  revalidatePath(`/${existing.slug}`);
  return NextResponse.json({ ok: true });
}
