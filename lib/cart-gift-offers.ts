import { db } from "@/lib/db";
import { campaignAvailable } from "@/lib/store-experience";
export type CartGiftOffer = { id: string; giftName: string; categoryName: string };
export async function cartGiftOffers(storeId: string, variantIds: string[]): Promise<CartGiftOffer[]> {
  if (!variantIds.length) return [];
  const [variants, campaigns] = await Promise.all([
    db.productVariant.findMany({ where: { id: { in: [...new Set(variantIds)] }, active: true, product: { storeId, status: "ACTIVE", shopVisible: true, category: { storeId, status: "PUBLISHED" } } }, select: { product: { select: { categoryId: true } } } }),
    db.giftCampaign.findMany({ where: { storeId, active: true }, select: { id: true, categoryId: true, giftName: true, giftProductId: true, giftProduct: { include: { variants: { where: { active: true } }, options: { where: { active: true, type: "COLOUR" }, take: 1, include: { values: { where: { active: true } } } } } }, active: true, awardedCount: true, limit: true, category: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const categories = new Set(variants.map(variant => variant.product.categoryId));
  return campaigns.filter(campaign => campaignAvailable(campaign) && categories.has(campaign.categoryId)).map(campaign => ({ id: campaign.id, giftName: campaign.giftName, categoryName: campaign.category.name }));
}
