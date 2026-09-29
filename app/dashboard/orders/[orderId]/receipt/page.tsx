import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";

export default async function ReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [user, store] = await Promise.all([requireUser(), getCurrentStorefront()]); const { orderId } = await params;
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id, userId: user.id, status: { notIn: ["PENDING", "PAYMENT_PENDING", "CANCELLED"] } }, include: { items: true, payments: { where: { status: "SUCCEEDED" }, take: 1 } } });
  if (!order) notFound();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: order.currency });
  return <section className="receipt-page"><div className="receipt-controls"><Link href={`/dashboard/orders/${order.id}`}>← Order</Link><span>Use your browser’s print menu to save a PDF.</span></div><header><strong>{order.storeDisplayName}</strong><div><h1>Receipt</h1><p>Order {order.orderNumber}<br />{order.createdAt.toLocaleDateString("en-AU")}</p></div></header><section><h2>Customer</h2><p>{order.customerName}<br />{user.email}</p><h2>Delivered to</h2><p>{order.shippingName}<br />{order.shippingLine1}<br />{order.shippingLine2 && <>{order.shippingLine2}<br /></>}{order.shippingSuburb}, {order.shippingState} {order.shippingPostcode}</p></section><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{order.items.map(item => <tr key={item.id}><td>{item.productName}<small>{item.variantName} · {item.sku}</small></td><td>{item.quantity}</td><td>{money.format(item.unitPriceCents / 100)}</td><td>{money.format(item.unitPriceCents * item.quantity / 100)}</td></tr>)}</tbody><tfoot><tr><td colSpan={3}>Subtotal</td><td>{money.format(order.subtotalCents / 100)}</td></tr><tr><td colSpan={3}>Shipping</td><td>{money.format(order.shippingCents / 100)}</td></tr><tr><td colSpan={3}><strong>Total paid</strong></td><td><strong>{money.format(order.totalCents / 100)}</strong></td></tr></tfoot></table><footer><p>Payment reference: {order.payments[0]?.providerPaymentIntentId ?? order.payments[0]?.providerSessionId ?? "Recorded payment"}</p><p>Amounts are in {order.currency} and include GST where applicable.</p></footer></section>;
}
