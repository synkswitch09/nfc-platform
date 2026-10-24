import { db } from "@/lib/db";
import { GiftPackingButton } from "@/components/gift-packing-button";
export async function OrderGifts({ orderId, packing = false }: { orderId: string; packing?: boolean }) {
  const gifts = await db.orderGift.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  if (!gifts.length) return null;
  return <section className="card order-gifts"><h2>Complimentary gifts</h2>{gifts.map(gift => <div key={gift.id}><p><strong>{gift.quantity} × {gift.giftName}</strong> · Included at no charge.</p>{packing && (gift.packedAt ? <p>Gift packed</p> : <GiftPackingButton orderId={orderId} giftId={gift.id} />)}</div>)}</section>;
}
