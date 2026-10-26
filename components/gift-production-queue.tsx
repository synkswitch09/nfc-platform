import Link from "next/link";
import { db } from "@/lib/db";
import { GiftPackingButton } from "@/components/gift-packing-button";
export async function GiftProductionQueue({ storeId }: { storeId: string }) {
  const gifts = await db.orderGift.findMany({ where: { requiresPrinting: true, printedAt: null, order: { storeId, status: { in: ["PAID", "PROCESSING"] } } }, include: { order: { select: { orderNumber: true, supportRequests: { where: { holdActive: true }, take: 1, select: { id: true } } } } }, orderBy: { createdAt: "asc" }, take: 100 });
  if (!gifts.length) return null;
  return <section className="admin-panel"><h2>Complimentary gifts to print</h2><p>Automatic gifts are included at AUD $0. Print the assigned colour before packing.</p>{gifts.map(gift => <article className="tag-row" key={gift.id}><div><strong>{gift.quantity} × {gift.giftName} · {gift.colour}</strong><p>{gift.sku} · {gift.material ?? "Material not specified"} · {gift.productionMinutes ?? 0} min</p><Link href={`/admin/orders/${gift.orderId}`}>{gift.order.orderNumber}</Link>{gift.order.supportRequests.length ? <p>Preparation paused — review the customer request.</p> : <GiftPackingButton orderId={gift.orderId} giftId={gift.id} action="PRINT" />}</div></article>)}</section>;
}
