import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const notice = vi.hoisted(() => vi.fn());
vi.mock("@/lib/order-notifications", () => ({ queueOrderNotice: notice }));
import { awardOrderGifts } from "@/lib/gift-campaigns";
const campaign = { id: "c", storeId: "s", categoryId: "cat", giftName: "Tray", limit: 50, awardedCount: 49, cycle: 1 };
const tx = { giftCampaign: { findMany: vi.fn(), updateMany: vi.fn() }, orderGift: { findUnique: vi.fn(), create: vi.fn() }, orderItem: { count: vi.fn() } };
beforeEach(() => { vi.resetAllMocks(); tx.giftCampaign.findMany.mockResolvedValue([campaign]); tx.giftCampaign.updateMany.mockResolvedValue({ count: 1 }); tx.orderItem.count.mockResolvedValue(1); });
const award = () => awardOrderGifts(tx as unknown as Prisma.TransactionClient, "o", "s");
it("awards exactly one gift for the category and disables the campaign at the limit", async () => {
  await award();
  expect(tx.orderItem.count).toHaveBeenCalledWith({ where: { orderId: "o", variant: { product: { storeId: "s", categoryId: "cat" } } } });
  expect(tx.giftCampaign.updateMany).toHaveBeenCalledWith({ where: { id: "c", active: true, cycle: 1, awardedCount: 49 }, data: { awardedCount: { increment: 1 }, active: false } });
  expect(tx.orderGift.create).toHaveBeenCalledWith({ data: { orderId: "o", campaignId: "c", cycle: 1, sequence: 50, giftName: "Tray" } });
  expect(notice).toHaveBeenCalledTimes(1);
});
it("does not consume slots for unrelated orders, exhausted campaigns or duplicate awards", async () => {
  tx.orderItem.count.mockResolvedValue(0); await award();
  tx.giftCampaign.findMany.mockResolvedValue([{ ...campaign, awardedCount: 50 }]); await award();
  tx.giftCampaign.findMany.mockResolvedValue([campaign]); tx.orderGift.findUnique.mockResolvedValue({ id: "existing" }); await award();
  expect(tx.giftCampaign.updateMany).not.toHaveBeenCalled(); expect(tx.orderGift.create).not.toHaveBeenCalled();
});
it("aborts a lost concurrent allocation so payment settlement can retry atomically", async () => {
  tx.giftCampaign.updateMany.mockResolvedValue({ count: 0 }); await expect(award()).rejects.toThrow("retry payment settlement");
  expect(tx.orderGift.create).not.toHaveBeenCalled(); expect(notice).not.toHaveBeenCalled();
});
