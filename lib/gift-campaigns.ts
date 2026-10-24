import type { Prisma } from "@prisma/client";
import { queueOrderNotice } from "@/lib/order-notifications";

/** Called only inside the serializable payment settlement transaction. */
export async function awardOrderGifts(tx: Prisma.TransactionClient, orderId: string, storeId: string) {
  const campaigns = await tx.giftCampaign.findMany({ where: { storeId, active: true }, orderBy: { createdAt: "asc" } });
  for (const campaign of campaigns) {
    if (campaign.awardedCount >= campaign.limit) continue;
    if (await tx.orderGift.findUnique({ where: { orderId_campaignId: { orderId, campaignId: campaign.id } } })) continue;
    const eligible = await tx.orderItem.count({ where: { orderId, variant: { product: { storeId, categoryId: campaign.categoryId } } } });
    if (!eligible) continue;
    // Optimistic compare-and-increment plus serializable isolation prevents
    // concurrent payments from exceeding the cap. Provider retries are safe.
    const changed = await tx.giftCampaign.updateMany({ where: { id: campaign.id, active: true, cycle: campaign.cycle, awardedCount: campaign.awardedCount }, data: { awardedCount: { increment: 1 }, ...(campaign.awardedCount + 1 >= campaign.limit ? { active: false } : {}) } });
    if (!changed.count) throw new Error("Gift campaign changed; retry payment settlement");
    await tx.orderGift.create({ data: { orderId, campaignId: campaign.id, cycle: campaign.cycle, sequence: campaign.awardedCount + 1, giftName: campaign.giftName } });
    await queueOrderNotice(tx, orderId, `gift:${campaign.id}:${orderId}`, "Your complimentary gift", `Your qualifying order includes 1 ${campaign.giftName} at no charge. It will be packed with your purchase.`, true);
  }
}
