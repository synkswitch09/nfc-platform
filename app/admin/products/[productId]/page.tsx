import { notFound } from "next/navigation";
import { AdminProductForm, type AdminProductInitial } from "@/components/admin-product-form";
import { ProductImageManager } from "@/components/product-image-manager";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export default async function EditProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const [product, categories, user] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { createdAt: "asc" } }, options: { include: { values: { where: { active: true }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } }),
    db.productCategory.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getCurrentUser(),
  ]);
  if (!product) notFound();
  const initial: AdminProductInitial = {
    id: product.id, name: product.name, slug: product.slug, description: product.description, fullDescription: product.fullDescription ?? "", categoryId: product.categoryId ?? "", type: product.type, status: product.status, featured: product.featured, shopVisible: product.shopVisible, brand: product.brand, gstInclusive: product.gstInclusive, seoTitle: product.seoTitle ?? "", seoDescription: product.seoDescription ?? "", ogImageUrl: product.ogImageUrl ?? "", canonicalUrl: product.canonicalUrl ?? "", indexable: product.indexable,
    variants: product.variants.map(variant => ({ id: variant.id, sku: variant.sku, name: variant.name, colour: variant.colour ?? "", size: variant.size ?? "", material: variant.material ?? "", price: (variant.priceCents / 100).toFixed(2), compareAtPrice: variant.compareAtPriceCents == null ? "" : (variant.compareAtPriceCents / 100).toFixed(2), cost: variant.costCents == null ? "" : (variant.costCents / 100).toFixed(2), inventory: variant.inventory, trackInventory: variant.trackInventory, lowStockThreshold: variant.lowStockThreshold, backorderPolicy: variant.backorderPolicy, active: variant.active })),
    options: product.options.map(option => ({ id: option.id, name: option.name, code: option.code, type: option.type, required: option.required, maxLength: option.maxLength, price: (option.priceDeltaCents / 100).toFixed(2), helpText: option.helpText ?? "", values: option.values.map(value => value.label).join(", ") })),
  };
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>Edit product</h1><p>{product.name} · updated {product.updatedAt.toLocaleDateString("en-AU")}</p></div></div><ProductImageManager productId={product.id} images={product.images} /><AdminProductForm initial={initial} categories={categories} canDelete={user?.role === "ADMIN"} /></div>;
}
