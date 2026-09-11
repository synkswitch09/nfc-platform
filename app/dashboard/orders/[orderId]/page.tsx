import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClearCartOnSuccess } from "@/components/clear-cart-on-success";
import { getCurrentStorefront } from "@/lib/storefront";

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [user, store] = await Promise.all([requireUser(), getCurrentStorefront()]); const { orderId } = await params;
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id, userId: user.id }, include: { items: true } });
  if (!order) notFound();
  return <section className="dashboard"><ClearCartOnSuccess /><Link className="muted" href="/dashboard">← Dashboard</Link><div className="dashboard-head"><div><h1>Order {order.orderNumber}</h1><p className={`status ${order.status}`}>{order.status.replaceAll("_", " ")}</p></div>{!["PENDING", "PAYMENT_PENDING", "CANCELLED"].includes(order.status) && <Link className="button secondary" href={`/dashboard/orders/${order.id}/receipt`}>View receipt</Link>}</div><div className="card">{order.items.map(item => <div className="tag-row" key={item.id}><div><strong>{item.productName}</strong><p>{item.variantName} · Qty {item.quantity}</p></div><strong>{new Intl.NumberFormat("en-AU",{style:"currency",currency:order.currency}).format(item.unitPriceCents * item.quantity / 100)}</strong></div>)}<p><strong>Total: {new Intl.NumberFormat("en-AU",{style:"currency",currency:order.currency}).format(order.totalCents / 100)}</strong></p>{order.trackingNumber && <p className="notice"><strong>{order.shippingCarrier}</strong><br />Tracking: {order.trackingNumber}</p>}</div></section>;
}
