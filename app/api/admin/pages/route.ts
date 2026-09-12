import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { contentPageSchema } from "@/lib/content-page-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = contentPageSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid page");
  const value = parsed.data;
  if (value.kind === "HOME" && await db.contentPage.count({ where: { storeId: context.store.id, kind: "HOME" } })) return jsonError("This Store already has a Home page", 409);
  try {
    const page = await db.$transaction(async tx => {
      const created = await tx.contentPage.create({ data: { storeId: context.store.id, defaultLocale: context.store.defaultLocale, ...value, seoTitle: value.seoTitle || null, seoDescription: value.seoDescription || null, ogImageUrl: value.ogImageUrl || null, canonicalUrl: value.canonicalUrl || null } });
      await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CONTENT_PAGE_CREATED", entityType: "ContentPage", entityId: created.id, metadata: { kind: created.kind, slug: created.slug } as Prisma.InputJsonValue } }); return created;
    });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) { return jsonError(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "That page slug is already in use" : "Page could not be created", 409); }
}
