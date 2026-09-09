import { AdminProductForm, type AdminProductInitial } from "@/components/admin-product-form";
import { db } from "@/lib/db";

const initial: AdminProductInitial = { name: "", slug: "", description: "", fullDescription: "", categoryId: "", type: "PET", status: "DRAFT", featured: false, shopVisible: false, brand: "Tapkin", gstInclusive: true, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false, variants: [], options: [] };

export default async function NewProductPage() {
  const categories = await db.productCategory.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>New product</h1><p>Create it as a draft, then publish when pricing and stock are ready.</p></div></div><AdminProductForm initial={initial} categories={categories} /></div>;
}
