import { availableGiftChoices, randomGiftChoice } from "@/lib/gift-variants";
import { consumeStock } from "@/lib/inventory-service";
import { reserveGiftProduction } from "@/lib/production-capacity";
import { queueEtsyInventorySync } from "@/lib/etsy";
import type { Prisma } from "@prisma/client";
import { queueOrderNotice } from "@/lib/order-notifications";

/** Called only inside the serializable payment settlement transaction. */
export async function awardOrderGifts(
  tx: Prisma.TransactionClient,
  orderId: string,
  storeId: string,
) {
  const campaigns = await tx.giftCampaign.findMany({
    where: { storeId, active: true },
    orderBy: { createdAt: "asc" },
  });
  for (const campaign of campaigns) {
    if (campaign.awardedCount >= campaign.limit) continue;
    if (
      await tx.orderGift.findUnique({
        where: { orderId_campaignId: { orderId, campaignId: campaign.id } },
      })
    )
      continue;
    const eligible = await tx.orderItem.count({
      where: {
        orderId,
        variant: { product: { storeId, categoryId: campaign.categoryId } },
      },
    });
    if (!eligible) continue;
    const product = campaign.giftProductId ? await tx.product.findFirst({ where: { id: campaign.giftProductId, storeId, status: "ACTIVE" }, include: { variants: { where: { active: true }, orderBy: [{ isDefault: "desc" }, { sku: "asc" }] }, options: { where: { active: true, type: "COLOUR" }, orderBy: { sortOrder: "asc" }, take: 1, include: { values: { where: { active: true }, orderBy: { sortOrder: "asc" } } } } } }) : null;
    const chosen = product ? randomGiftChoice(availableGiftChoices(product)) : undefined;
    if (campaign.giftProductId && !chosen) continue;
    // Optimistic compare-and-increment plus serializable isolation prevents
    // concurrent payments from exceeding the cap. Provider retries are safe.
    const changed = await tx.giftCampaign.updateMany({
      where: {
        id: campaign.id,
        active: true,
        cycle: campaign.cycle,
        awardedCount: campaign.awardedCount,
      },
      data: {
        awardedCount: { increment: 1 },
        ...(campaign.awardedCount + 1 >= campaign.limit
          ? { active: false }
          : {}),
      },
    });
    if (!changed.count)
      throw new Error("Gift campaign changed; retry payment settlement");
    await tx.orderGift.create({
      data: {
        orderId,
        campaignId: campaign.id,
        cycle: campaign.cycle,
        sequence: campaign.awardedCount + 1,
        giftName: campaign.giftName,
        ...(chosen ? { variantId: chosen.variant.id, sku: chosen.variant.sku, colour: chosen.colour, colourHex: chosen.colourHex, material: chosen.variant.material, requiresPrinting: chosen.requiresPrinting, productionMinutes: chosen.requiresPrinting ? chosen.variant.productionMinutes : 0 } : {}),
      },
    });
    if (chosen) {
      if (!chosen.requiresPrinting) {
        await consumeStock(tx, { variantId: chosen.variant.id, orderId, quantity: 1, held: 0, inventory: chosen.variant.inventory, reservedInventory: chosen.variant.reservedInventory, backorder: false, reason: "Complimentary campaign gift" });
        await queueEtsyInventorySync(tx, storeId, campaign.giftProductId!);
      } else await reserveGiftProduction(tx, orderId, chosen.variant.productionMinutes!);
    }
    await queueOrderNotice(
      tx,
      orderId,
      `gift:${campaign.id}:${orderId}`,
      "Your complimentary gift",
      `Your qualifying order includes 1 ${campaign.giftName}${chosen ? ` in ${chosen.colour}` : ""} at no charge. It will be packed with your purchase.`,
      true,
    );
  }
}
