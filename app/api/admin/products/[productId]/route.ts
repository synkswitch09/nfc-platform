import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiContext } from "@/lib/admin";
import { adminProductSchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { createPublicTagId } from "@/lib/crypto";
import { canHardDeleteProduct } from "@/lib/catalog-policy";
import { deleteStoredImage } from "@/lib/uploads";

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const { productId } = await params;
  const source = await db.product.findFirst({ where: { id: productId, storeId: store.id }, include: { variants: true, options: { include: { values: true } } } });
  if (!source) return jsonError("Product not found", 404);
  const suffix = createPublicTagId().slice(0, 6).toLowerCase();
  try {
    const duplicate = await db.$transaction(async tx => {
      const product = await tx.product.create({ data: { storeId: store.id, name: `${source.name} (copy)`, slug: `${source.slug.slice(0, 150)}-${suffix}`, description: source.description, shortDescription: source.shortDescription, fullDescription: source.fullDescription, categoryId: source.categoryId, type: source.type, status: "DRAFT", featured: false, shopVisible: false, brand: source.brand, gstInclusive: source.gstInclusive, seoTitle: source.seoTitle, seoDescription: source.seoDescription, ogImageUrl: source.ogImageUrl, canonicalUrl: null, indexable: false,
        variants: { create: source.variants.map(variant => ({ sku: `${variant.sku.slice(0, 42)}-${suffix.toUpperCase()}`, name: variant.name, colour: variant.colour, size: variant.size, material: variant.material, priceCents: variant.priceCents, compareAtPriceCents: variant.compareAtPriceCents, costCents: variant.costCents, inventory: 0, reservedInventory: 0, trackInventory: variant.trackInventory, lowStockThreshold: variant.lowStockThreshold, backorderPolicy: variant.backorderPolicy, active: variant.active })) },
        options: { create: source.options.map(option => ({ name: option.name, code: option.code, type: option.type, required: option.required, maxLength: option.maxLength, priceDeltaCents: option.priceDeltaCents, helpText: option.helpText, sortOrder: option.sortOrder, active: option.active, values: { create: option.values.map(value => ({ label: value.label, value: value.value, priceDeltaCents: value.priceDeltaCents, sortOrder: value.sortOrder, active: value.active })) } })) },
      } });
      await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "PRODUCT_DUPLICATED", entityType: "Product", entityId: product.id, metadata: { sourceProductId: source.id } } });
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
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const parsed = adminProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid product");
  const { productId } = await params;
  const existing = await db.product.findFirst({ where: { id: productId, storeId: store.id }, select: { id: true, status: true, variants: { select: { id: true, priceCents: true, inventory: true } } } });
  if (!existing) return jsonError("Product not found", 404);
  const data = parsed.data;
  try {
    await db.$transaction(async tx => {
      if (data.categoryId) {
        const category = await tx.productCategory.findFirst({ where: { id: data.categoryId, storeId: store.id }, select: { id: true } });
        if (!category) throw new Error("INVALID_CATEGORY");
      }
      await tx.product.update({ where: { id: productId }, data: { name: data.name, slug: data.slug, description: data.description, shortDescription: data.description, fullDescription: data.fullDescription || null, categoryId: data.categoryId || null, type: data.type, status: data.status, featured: data.featured, shopVisible: data.shopVisible, brand: data.brand, gstInclusive: data.gstInclusive, seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null, ogImageUrl: data.ogImageUrl || null, canonicalUrl: data.canonicalUrl || null, indexable: data.indexable } });
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
      await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: existing.status === data.status ? "PRODUCT_UPDATED" : "PRODUCT_STATUS_CHANGED", entityType: "Product", entityId: productId, metadata: { fromStatus: existing.status, toStatus: data.status } } });
      const previous = new Map(existing.variants.map(variant => [variant.id, variant]));
      if (data.variants.some(variant => !variant.id || previous.get(variant.id)?.priceCents !== variant.priceCents)) await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "PRODUCT_PRICE_CHANGED", entityType: "Product", entityId: productId } });
      if (data.variants.some(variant => !variant.id || previous.get(variant.id)?.inventory !== variant.inventory)) await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "PRODUCT_INVENTORY_CHANGED", entityType: "Product", entityId: productId } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CATEGORY") return jsonError("Category does not belong to this store", 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("Slug, SKU or option code is already in use", 409);
    return jsonError("Product could not be updated", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context || context.user.role !== "ADMIN") return jsonError("Administrator access required", 403);
  const { user, store } = context;
  const { productId } = await params;
  const product = await db.product.findFirst({ where: { id: productId, storeId: store.id }, include: { images: { select: { storageKey: true } }, variants: { select: { id: true, _count: { select: { orderItems: true, inventoryMovements: true } } } }, _count: { select: { tags: true, batches: true } } } });
  if (!product) return jsonError("Product not found", 404);
  const history = { orderItems: product.variants.reduce((sum, variant) => sum + variant._count.orderItems, 0), inventoryMovements: product.variants.reduce((sum, variant) => sum + variant._count.inventoryMovements, 0), tags: product._count.tags, batches: product._count.batches };
  if (!canHardDeleteProduct(history)) return jsonError("This product has historical data and cannot be permanently deleted. Archive it instead.", 409);
  const variantIds = product.variants.map(variant => variant.id);
  await db.$transaction(async tx => {
    if (variantIds.length) await tx.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
    await tx.productVariant.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
    await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "PRODUCT_DELETED", entityType: "Product", entityId: productId, metadata: { name: product.name } } });
  });
  await Promise.all(product.images.map(image => deleteStoredImage(image.storageKey)));
  return NextResponse.json({ ok: true });
}
