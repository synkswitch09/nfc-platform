import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClearCartOnSuccess } from "@/components/clear-cart-on-success";

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser(); const { orderId } = await params;
  const order = await db.order.findFirst({ where: { id: orderId, userId: user.id }, include: { items: true } });
  if (!order) notFound();
  return <section className="dashboard"><ClearCartOnSuccess /><Link className="muted" href="/dashboard">← Dashboard</Link><h1>Order {order.orderNumber}</h1><p className={`status ${order.status}`}>{order.status}</p><div className="card">{order.items.map(item => <div className="tag-row" key={item.id}><div><strong>{item.productName}</strong><p>{item.variantName} · Qty {item.quantity}</p></div><strong>{new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(item.unitPriceCents * item.quantity / 100)}</strong></div>)}<p><strong>Total: {new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(order.totalCents / 100)}</strong></p></div></section>;
}
