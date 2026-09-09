import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiUser } from "@/lib/admin";
import { adminProductSchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const parsed = adminProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid product");
  const data = parsed.data;
  try {
    const product = await db.$transaction(async tx => {
      const created = await tx.product.create({ data: {
        name: data.name, slug: data.slug, description: data.description, shortDescription: data.description, fullDescription: data.fullDescription || null,
        categoryId: data.categoryId || null, type: data.type, status: data.status, featured: data.featured, shopVisible: data.shopVisible, brand: data.brand, gstInclusive: data.gstInclusive,
        seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null, ogImageUrl: data.ogImageUrl || null, canonicalUrl: data.canonicalUrl || null, indexable: data.indexable,
        variants: { create: data.variants.map(variant => ({ sku: variant.sku, name: variant.name, colour: variant.colour || null, size: variant.size || null, material: variant.material || null, priceCents: variant.priceCents, compareAtPriceCents: variant.compareAtPriceCents || null, costCents: variant.costCents || null, inventory: variant.inventory, trackInventory: variant.trackInventory, lowStockThreshold: variant.lowStockThreshold, backorderPolicy: variant.backorderPolicy, active: variant.active })) },
        options: { create: data.options.map((option, sortOrder) => ({ name: option.name, code: option.code, type: option.type, required: option.required, maxLength: option.maxLength || null, priceDeltaCents: option.priceDeltaCents, helpText: option.helpText || null, active: option.active, sortOrder, values: { create: option.values.map((value, valueOrder) => ({ label: value.label, value: value.value, priceDeltaCents: value.priceDeltaCents, active: value.active, sortOrder: valueOrder })) } })) },
      } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_CREATED", entityType: "Product", entityId: created.id, metadata: { name: created.name, status: created.status } } });
      return created;
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("Slug or SKU is already in use", 409);
    return jsonError("Product could not be created", 500);
  }
}
