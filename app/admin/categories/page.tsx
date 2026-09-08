import { AdminCategoryManager } from "@/components/admin-category-manager";
import { db } from "@/lib/db";

export default async function AdminCategoriesPage() {
  const categories = await db.productCategory.findMany({ include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>Categories</h1><p>Manage storefront navigation and category SEO.</p></div></div><AdminCategoryManager categories={categories} /></div>;
}
