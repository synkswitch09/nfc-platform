import { z } from "zod";

const uuid = z.string().uuid();
const clientId = z.string().regex(/^\d{1,10}\.\d{1,10}$/);
export const commerceEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("view_item"), clientId, productId: uuid }),
  z.object({ event: z.literal("begin_checkout"), clientId, items: z.array(z.object({ variantId: uuid, quantity: z.number().int().min(1).max(100) })).min(1).max(30) }),
  z.object({ event: z.literal("purchase"), clientId, orderId: uuid, claimToken: z.string().min(20).max(200).optional() }),
]);

export function purchaseEligible(status: string) {
  return ["PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED"].includes(status);
}

export function commercePayload(event: "view_item" | "begin_checkout" | "purchase", params: Record<string, unknown>, clientId: string) {
  // Only this allowlisted payload leaves our server. No URL, referrer, email,
  // IP, publicTagId, customer name, shipping address or personalised text.
  return { client_id: clientId, non_personalized_ads: true, events: [{ name: event, params }] };
}

export function purchaseParams(order: {
  id: string; currency: string; totalCents: number;
  items: { variantId: string; quantity: number; unitPriceCents: number }[];
}) {
  return { transaction_id: order.id, currency: order.currency, value: order.totalCents / 100,
    items: order.items.map(item => ({ item_id: item.variantId, quantity: item.quantity, price: item.unitPriceCents / 100 })) };
}
