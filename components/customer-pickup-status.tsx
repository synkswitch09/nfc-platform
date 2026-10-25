import { parsePickupConfig } from "@/lib/local-pickup";
export function CustomerPickupStatus({ order }: { order: { deliveryMethod: string; status: string; pickupSnapshot: unknown; orderNumber: string } }) {
  if (order.deliveryMethod !== "PICKUP") return null;
  const ready = ["READY_TO_SHIP", "COMPLETED"].includes(order.status);
  if (!ready) return <div className="card"><h2>Local pickup — Free</h2><p>Please wait for your ready-for-pickup email. It will include the address and collection instructions.</p></div>;
  const pickup = parsePickupConfig(order.pickupSnapshot);
  return <div className="card"><h2>{order.status === "COMPLETED" ? "Collected" : "Ready for pickup"}</h2><p>{pickup.address}</p><p>{pickup.hours}</p>{pickup.instructions && <p>{pickup.instructions}</p>}<p>Bring your order number: {order.orderNumber}.</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.address)}`} target="_blank" rel="noopener noreferrer">View pickup location</a></div>;
}
