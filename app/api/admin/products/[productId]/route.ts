import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiUser } from "@/lib/admin";
import { adminProductSchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { createPublicTagId } from "@/lib/crypto";

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const { productId } = await params;
  const source = await db.product.findUnique({ where: { id: productId }, include: { variants: true, options: { include: { values: true } } } });
  if (!source) return jsonError("Product not found", 404);
  const suffix = createPublicTagId().slice(0, 6).toLowerCase();
  try {
    const duplicate = await db.$transaction(async tx => {
      const product = await tx.product.create({ data: { name: `${source.name} (copy)`, slug: `${source.slug.slice(0, 150)}-${suffix}`, description: source.description, shortDescription: source.shortDescription, fullDescription: source.fullDescription, categoryId: source.categoryId, type: source.type, status: "DRAFT", featured: false, brand: source.brand, gstInclusive: source.gstInclusive, seoTitle: source.seoTitle, seoDescription: source.seoDescription, ogImageUrl: source.ogImageUrl, canonicalUrl: null, indexable: false,
        variants: { create: source.variants.map(variant => ({ sku: `${variant.sku.slice(0, 42)}-${suffix.toUpperCase()}`, name: variant.name, colour: variant.colour, size: variant.size, material: variant.material, priceCents: variant.priceCents, compareAtPriceCents: variant.compareAtPriceCents, costCents: variant.costCents, inventory: 0, reservedInventory: 0, trackInventory: variant.trackInventory, lowStockThreshold: variant.lowStockThreshold, backorderPolicy: variant.backorderPolicy, active: variant.active })) },
        options: { create: source.options.map(option => ({ name: option.name, code: option.code, type: option.type, required: option.required, maxLength: option.maxLength, priceDeltaCents: option.priceDeltaCents, helpText: option.helpText, sortOrder: option.sortOrder, active: option.active, values: { create: option.values.map(value => ({ label: value.label, value: value.value, priceDeltaCents: value.priceDeltaCents, sortOrder: value.sortOrder, active: value.active })) } })) },
      } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_DUPLICATED", entityType: "Product", entityId: product.id, metadata: { sourceProductId: source.id } } });
      return product;
    });
    return NextResponse.json({ product: { id: duplicate.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("Could not allocate a unique slug or SKU; try again", 409);
    return jsonError("Product could not be duplicated", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const parsed = adminProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid product");
  const { productId } = await params;
  const existing = await db.product.findUnique({ where: { id: productId }, select: { id: true, status: true } });
  if (!existing) return jsonError("Product not found", 404);
  const data = parsed.data;
  try {
    await db.$transaction(async tx => {
      await tx.product.update({ where: { id: productId }, data: { name: data.name, slug: data.slug, description: data.description, shortDescription: data.description, fullDescription: data.fullDescription || null, categoryId: data.categoryId || null, type: data.type, status: data.status, featured: data.featured, brand: data.brand, gstInclusive: data.gstInclusive, seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null, ogImageUrl: data.ogImageUrl || null, canonicalUrl: data.canonicalUrl || null, indexable: data.indexable } });
      const variantIds = data.variants.flatMap(variant => variant.id ? [variant.id] : []);
      await tx.productVariant.updateMany({ where: { productId, id: { notIn: variantIds } }, data: { active: false } });
      for (const variant of data.variants) {
        const values = { sku: variant.sku, name: variant.name, colour: variant.colour || null, size: variant.size || null, material: variant.material || null, priceCents: variant.priceCents, compareAtPriceCents: variant.compareAtPriceCents || null, costCents: variant.costCents || null, inventory: variant.inventory, trackInventory: variant.trackInventory, lowStockThreshold: variant.lowStockThreshold, backorderPolicy: variant.backorderPolicy, active: variant.active };
        if (variant.id) { const updated = await tx.productVariant.updateMany({ where: { id: variant.id, productId }, data: values }); if (updated.count !== 1) throw new Error("INVALID_VARIANT"); }
        else await tx.productVariant.create({ data: { ...values, productId } });
      }
      const optionIds = data.options.flatMap(option => option.id ? [option.id] : []);
      await tx.productOption.deleteMany({ where: { productId, id: { notIn: optionIds } } });
      for (const [sortOrder, option] of data.options.entries()) {
        const values = { name: option.name, code: option.code, type: option.type, required: option.required, maxLength: option.maxLength || null, priceDeltaCents: option.priceDeltaCents, helpText: option.helpText || null, active: option.active, sortOrder };
        if (option.id) {
          const updated = await tx.productOption.updateMany({ where: { id: option.id, productId }, data: values }); if (updated.count !== 1) throw new Error("INVALID_OPTION");
          await tx.productOptionValue.deleteMany({ where: { optionId: option.id } });
          if (option.values.length) await tx.productOptionValue.createMany({ data: option.values.map((value, valueOrder) => ({ optionId: option.id!, label: value.label, value: value.value, priceDeltaCents: value.priceDeltaCents, active: value.active, sortOrder: valueOrder })) });
        } else await tx.productOption.create({ data: { ...values, productId, values: { create: option.values.map((value, valueOrder) => ({ label: value.label, value: value.value, priceDeltaCents: value.priceDeltaCents, active: value.active, sortOrder: valueOrder })) } } });
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: existing.status === data.status ? "PRODUCT_UPDATED" : "PRODUCT_STATUS_CHANGED", entityType: "Product", entityId: productId, metadata: { fromStatus: existing.status, toStatus: data.status } } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("Slug, SKU or option code is already in use", 409);
    return jsonError("Product could not be updated", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const { productId } = await params;
  const archived = await db.product.updateMany({ where: { id: productId, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
  if (archived.count !== 1) return jsonError("Product not found", 404);
  await db.productVariant.updateMany({ where: { productId }, data: { active: false } });
  await db.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_ARCHIVED", entityType: "Product", entityId: productId } });
  return NextResponse.json({ ok: true });
}
