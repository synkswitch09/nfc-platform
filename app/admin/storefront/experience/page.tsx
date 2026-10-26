import Link from "next/link";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { getExperience } from "@/lib/store-experience";
import { StoreExperienceAdmin } from "@/components/store-experience-admin";
export default async function ExperiencePage() {
  const { store } = await requireAdminPageContext();
  const [{ config }, campaign, categories, reviews, products] = await Promise.all([
    getExperience(store.id),
    db.giftCampaign.findUnique({
      where: { storeId_key: { storeId: store.id, key: "launch-stands" } },
    }),
    db.productCategory.findMany({
      where: { storeId: store.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.productReview.findMany({
      where: { storeId: store.id },
      include: {
        product: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.product.findMany({ where: { storeId: store.id, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <Link href="/admin/storefront">← Storefront</Link>
      <h1>Shared banners, gifts & reviews</h1>
      <StoreExperienceAdmin
        initial={config}
        campaign={campaign}
        categories={categories}
        reviews={reviews}
        products={products}
      />
    </div>
  );
}
