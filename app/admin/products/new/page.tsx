import { AdminProductForm, type AdminProductInitial } from "@/components/admin-product-form";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";

export default async function NewProductPage() {
  const { store } = await requireAdminPageContext();
  const initial: AdminProductInitial = { name: "", slug: "", description: "", fullDescription: "", categoryId: "", type: "ACCESSORY", status: "DRAFT", featured: false, shopVisible: false, brand: store.displayName, gstInclusive: true, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false, variants: [], options: [] };
  const categories = await db.productCategory.findMany({ where: { storeId: store.id, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>New product</h1><p>Create it as a draft, then publish when pricing and stock are ready.</p></div></div><AdminProductForm initial={initial} categories={categories} /></div>;
}
