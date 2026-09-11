import { AdminProductForm, type AdminProductInitial } from "@/components/admin-product-form";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";

export default async function NewProductPage() {
  const { store } = await requireAdminPageContext();
  const initial: AdminProductInitial = { name: "", slug: "", description: "", fullDescription: "", categoryId: "", type: "ACCESSORY", status: "DRAFT", featured: false, shopVisible: false, brand: store.displayName, gstInclusive: true, personalisationMode: "NONE", weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, defaultPackagingId: "", shipsSeparately: false, specialHandling: "", seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false, variants: [], options: [] };
  const [categories, packaging] = await Promise.all([
    db.productCategory.findMany({ where: { storeId: store.id, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.packaging.findMany({ where: { storeId: store.id, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>New product</h1><p>Create it as a draft, then publish when pricing and stock are ready.</p></div></div><AdminProductForm initial={initial} categories={categories} packaging={packaging} /></div>;
}
