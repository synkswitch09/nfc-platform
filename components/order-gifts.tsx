import { db } from "@/lib/db";
import { GiftPackingButton } from "@/components/gift-packing-button";
export async function OrderGifts({
  orderId,
  packing = false,
}: {
  orderId: string;
  packing?: boolean;
}) {
  const gifts = await db.orderGift.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  if (!gifts.length) return null;
  return (
    <section className="card order-gifts">
      <h2>Complimentary gifts</h2>
      {gifts.map((gift) => (
        <div key={gift.id}>
          <p>
            <strong>
              {gift.quantity} × {gift.giftName}
            </strong>{" "}
            · Included at no charge.
            {gift.colour && <> Colour: <strong>{gift.colour}</strong>.</>}
          </p>
          {packing && <p>SKU: {gift.sku ?? "Legacy gift — confirm manually"}{gift.material ? ` · ${gift.material}` : ""}{gift.productionMinutes ? ` · Print time: ${gift.productionMinutes} min` : ""}{gift.requiresPrinting ? gift.printedAt ? " · Printed and checked" : " · To print" : " · Packing instruction"}</p>}
          {packing &&
            (gift.packedAt ? (
              <p>Gift packed</p>
            ) : gift.requiresPrinting && !gift.printedAt ? <GiftPackingButton orderId={orderId} giftId={gift.id} action="PRINT" /> : (
              <GiftPackingButton orderId={orderId} giftId={gift.id} />
            ))}
        </div>
      ))}
    </section>
  );
}
