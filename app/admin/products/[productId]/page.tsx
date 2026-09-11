import { notFound } from "next/navigation";
import { AdminProductForm, type AdminProductInitial } from "@/components/admin-product-form";
import { ProductImageManager } from "@/components/product-image-manager";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";

export default async function EditProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const { user, store } = await requireAdminPageContext();
  const [product, categories, packaging] = await Promise.all([
    db.product.findFirst({ where: { id: productId, storeId: store.id }, include: { images: { include: { variants: { select: { id: true } } }, orderBy: { sortOrder: "asc" } }, variants: { orderBy: { createdAt: "asc" } }, options: { include: { values: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } }),
    db.productCategory.findMany({ where: { storeId: store.id }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.packaging.findMany({ where: { storeId: store.id, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();
  const initial: AdminProductInitial = {
    id: product.id, name: product.name, slug: product.slug, description: product.description, fullDescription: product.fullDescription ?? "", categoryId: product.categoryId ?? "", type: product.type, status: product.status, featured: product.featured, shopVisible: product.shopVisible, brand: product.brand, gstInclusive: product.gstInclusive, personalisationMode: product.personalisationMode, weightGrams: product.weightGrams, lengthMm: product.lengthMm, widthMm: product.widthMm, heightMm: product.heightMm, defaultPackagingId: product.defaultPackagingId ?? "", shipsSeparately: product.shipsSeparately, specialHandling: product.specialHandling ?? "", seoTitle: product.seoTitle ?? "", seoDescription: product.seoDescription ?? "", ogImageUrl: product.ogImageUrl ?? "", canonicalUrl: product.canonicalUrl ?? "", indexable: product.indexable,
    variants: product.variants.map(variant => ({ id: variant.id, sku: variant.sku, name: variant.name, colour: variant.colour ?? "", size: variant.size ?? "", material: variant.material ?? "", price: (variant.priceCents / 100).toFixed(2), compareAtPrice: variant.compareAtPriceCents == null ? "" : (variant.compareAtPriceCents / 100).toFixed(2), cost: variant.costCents == null ? "" : (variant.costCents / 100).toFixed(2), inventory: variant.inventory, trackInventory: variant.trackInventory, lowStockThreshold: variant.lowStockThreshold, backorderPolicy: variant.backorderPolicy, active: variant.active, isDefault: variant.isDefault, optionSelection: Object.entries(variant.optionSelection as Record<string, string>).map(([key, value]) => `${key}=${value}`).join(","), weightGrams: variant.weightGrams, lengthMm: variant.lengthMm, widthMm: variant.widthMm, heightMm: variant.heightMm, defaultPackagingId: variant.defaultPackagingId ?? "" })),
    options: product.options.map(option => ({ id: option.id, name: option.name, code: option.code, type: option.type, required: option.required, maxLength: option.maxLength, price: (option.priceDeltaCents / 100).toFixed(2), helpText: option.helpText ?? "", values: option.values.map(value => ({ id: value.id, label: value.label, value: value.value, price: (value.priceDeltaCents / 100).toFixed(2), active: value.active, swatchHex: value.swatchHex ?? "#000000", swatchHexSecondary: value.swatchHexSecondary ?? "", swatchImageUrl: value.swatchImageUrl ?? "" })) })),
  };
  const imageOptions = product.options.filter(option => option.type === "COLOUR").flatMap(option => option.values.map(value => ({ id: value.id, label: `${option.name}: ${value.label}` })));
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>Edit product</h1><p>{product.name} · updated {product.updatedAt.toLocaleDateString("en-AU")}</p></div></div><ProductImageManager productId={product.id} images={product.images.map(image => ({ ...image, variantId: image.variants[0]?.id ?? null }))} optionValues={imageOptions} variants={product.variants.map(variant => ({ id: variant.id, label: variant.name }))} /><AdminProductForm initial={initial} categories={categories} packaging={packaging} canDelete={user?.role === "ADMIN"} /></div>;
}
