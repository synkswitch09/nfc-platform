import { notFound } from "next/navigation";
import {ReorderButton} from "@/components/reorder-button";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClearCartOnSuccess } from "@/components/clear-cart-on-success";

import { CustomerShippingStatus } from "@/components/customer-shipping-status";
import { CommerceAnalyticsEvent } from "@/components/commerce-analytics";
import { purchaseEligible } from "@/lib/commerce-analytics";
import { getCurrentStorefront } from "@/lib/storefront";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const [user, store, query] = await Promise.all([requireUser(), getCurrentStorefront(), searchParams]); const { orderId } = await params;
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id, userId: user.id }, include: { items: true, productionBooking: true, shipments: { where: { idempotencyKey: { startsWith: "shippit:" } }, orderBy: { createdAt: "asc" } } } });
  if (!order) notFound();
  return <section className="dashboard"><ClearCartOnSuccess paid={purchaseEligible(order.status)} orderId={order.id} />{(purchaseEligible(order.status) || (query.checkout === "success" && order.status !== "CANCELLED" && order.status !== "REFUNDED")) && <CommerceAnalyticsEvent store={store.slug} data={{ event: "purchase", orderId: order.id }} />}<Link className="muted" href="/dashboard">← Dashboard</Link><div className="dashboard-head"><div><h1>Order {order.orderNumber}</h1><p className={`status ${order.status}`}>{["SHIPPED", "DELIVERED", "COMPLETED"].includes(order.status) ? (order.status === "SHIPPED" ? "Shipped" : "Delivered") : ["PAYMENT_PENDING", "PENDING", "CANCELLED", "REFUNDED"].includes(order.status) ? order.status.replaceAll("_", " ") : "Preparing your order"}</p></div>{!["PENDING", "PAYMENT_PENDING", "CANCELLED"].includes(order.status) && <Link className="button secondary" href={`/dashboard/orders/${order.id}/receipt`}>View receipt</Link>}</div><div className="card">{order.items.map(item => <div className="tag-row" key={item.id}><div><strong>{item.productName}</strong><p>{item.variantName} · Qty {item.quantity}</p></div><strong>{new Intl.NumberFormat("en-AU",{style:"currency",currency:order.currency}).format(item.unitPriceCents * item.quantity / 100)}</strong></div>)}{order.discountCents > 0 && <p>Discount: -{new Intl.NumberFormat("en-AU",{style:"currency",currency:order.currency}).format(order.discountCents / 100)}</p>}<p><strong>Total: {new Intl.NumberFormat("en-AU",{style:"currency",currency:order.currency}).format(order.totalCents / 100)}</strong></p>{order.productionBooking && !order.productionBooking.releasedAt && <p className="notice">Estimated dispatch: {order.productionBooking.promisedAt.toLocaleDateString("en-AU")}</p>}{order.trackingNumber && <p className="notice"><strong>{order.shippingCarrier}</strong><br />Tracking: {order.trackingNumber}</p>}</div><CustomerShippingStatus parcels={order.shipments} /><div className="actions"><Link className="text-button" href={`/dashboard/help?order=${order.id}`}>Help with this order</Link><ReorderButton orderId={order.id}/></div></section>;
}
