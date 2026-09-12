import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { adminCategorySchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const parsed = adminCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid category");
  try {
    const category = await db.$transaction(async tx => {
      const collision = await tx.productCategory.findFirst({
        where: { storeId: store.id, OR: [{ slug: parsed.data.slug }, { legacySlugs: { has: parsed.data.slug } }] },
        select: { id: true },
      });
      if (collision) throw new Error("CATEGORY_SLUG_CONFLICT");
      const created = await tx.productCategory.create({ data: { ...parsed.data, storeId: store.id } });
      await tx.contentPage.create({ data: { id: created.id, storeId: store.id, categoryId: created.id, kind: "CATEGORY", slug: created.slug, name: created.name, status: created.status, sortOrder: created.sortOrder, defaultLocale: store.defaultLocale, seoTitle: created.seoTitle, seoDescription: created.seoDescription, ogImageUrl: created.ogImageUrl, canonicalUrl: created.canonicalUrl, indexable: created.indexable } });
      await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "CATEGORY_CREATED", entityType: "ProductCategory", entityId: created.id, metadata: { status: created.status } } });
      return created;
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_SLUG_CONFLICT") return jsonError("That category slug is already in use", 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("That category slug is already in use", 409);
    return jsonError("Category could not be created", 500);
  }
}
