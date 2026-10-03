import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";
import { PromotionsAdmin } from "@/components/promotions-admin";

export default async function PromotionsPage() {
  const { store } = await requireAdminPageContext();
  const [promotions, products] = await Promise.all([
    db.promotion.findMany({ where: { storeId: store.id }, include: { product: { select: { name: true } }, _count: { select: { orders: true } } }, orderBy: { createdAt: "desc" } }),
    db.product.findMany({ where: { storeId: store.id, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <div><div className="admin-heading"><div><p className="admin-kicker">Sales · {store.displayName}</p><h1>Promotions</h1><p>Codes and automatic offers apply to this store only.</p></div></div><PromotionsAdmin rewardEnabled={store.secondPurchaseRewardEnabled} promotions={promotions.map(item => ({ id: item.id, name: item.name, code: item.code, kind: item.kind, active: item.active, productName: item.product?.name ?? null, orders: item._count.orders, endsAt: item.endsAt?.toISOString() ?? null }))} products={products} /></div>;
}
