import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusForm } from "@/components/order-status-form";
import { ShipmentActions } from "@/components/shipment-actions";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { orderTransitions } from "@/lib/order-status";

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { store } = await requireAdminPageContext();
  const order = await db.order.findFirst({
    where: { id: orderId, storeId: store.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: true,
      payments: true,
      shipments: { include: { printJobs: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } },
      statusHistory: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: order.currency });
  const shipment = order.shipments[0];
  return <div>
    <Link href="/admin/orders" className="admin-back">← Orders</Link>
    <div className="admin-heading"><div><p className="admin-kicker">{order.createdAt.toLocaleString("en-AU")}</p><h1>{order.orderNumber}</h1><p>{order.customerName ?? "Customer"} · {order.user?.email ?? order.guestEmail}</p></div><span className={`admin-status large ${order.status}`}>{order.status.replaceAll("_", " ")}</span></div>
    <div className="admin-split order-detail">
      <div>
        <section className="admin-panel"><div className="panel-heading"><div><h2>Production items</h2><p>These snapshots never change when the catalog is edited.</p></div></div><div className="order-lines">{order.items.map(item => <article key={item.id}><div><strong>{item.productName}</strong><span>{item.variantName} · {item.sku} · Qty {item.quantity} · {item.personalisationChoice === "PERSONALISED" ? "Personalised" : "Basic"}</span><SnapshotList value={item.selectedOptions} label="Product options" /><SnapshotList value={item.personalisation} label="Custom details" /></div><strong>{money.format(item.unitPriceCents * item.quantity / 100)}</strong></article>)}</div><div className="order-totals"><span>Subtotal <strong>{money.format(order.subtotalCents / 100)}</strong></span><span>Shipping <strong>{money.format(order.shippingCents / 100)}</strong></span><span>Total <strong>{money.format(order.totalCents / 100)}</strong></span></div></section>
        <section className="admin-panel"><div className="panel-heading"><div><h2>Status history</h2><p>Immutable operational trail.</p></div></div><div className="timeline">{order.statusHistory.map(item => <article key={item.id}><span></span><div><strong>{item.toStatus.replaceAll("_", " ")}</strong><small>{item.createdAt.toLocaleString("en-AU")} · {item.actor?.name ?? "System"}</small>{item.note && <p>{item.note}</p>}</div></article>)}</div></section>
      </div>
      <aside>
        <section className="admin-panel"><h2>Next action</h2><OrderStatusForm orderId={order.id} options={orderTransitions[order.status] ?? []} shipping={{ carrier: order.shippingCarrier, trackingNumber: order.trackingNumber }} /></section>
        <section className="admin-panel"><h2>Shipment</h2>{shipment ? <><p><strong>{shipment.serviceName}</strong><br /><span className="muted">{shipment.status.replaceAll("_", " ")} · {shipment.trackingNumber ?? "Tracking pending"}</span></p>{shipment.status === "LABEL_READY" && <ShipmentActions orderId={order.id} shipmentId={shipment.id} />}<p className="muted">Label: {shipment.labelCreatedAt ? "Ready" : "Pending"} · Print queue: {shipment.printJobs[0]?.status ?? "No job"}</p></> : order.status === "READY_TO_SHIP" ? <ShipmentActions orderId={order.id} /> : <p className="muted">Mark this order ready to ship before creating its label.</p>}</section>
        <section className="admin-panel"><h2>Ship to</h2><address>{order.shippingName}<br />{order.shippingLine1}<br />{order.shippingLine2 && <>{order.shippingLine2}<br /></>}{order.shippingSuburb}, {order.shippingState} {order.shippingPostcode}<br />{order.shippingCountry}</address>{order.trackingNumber && <p><strong>{order.shippingCarrier}</strong><br /><span className="muted">{order.trackingNumber}</span></p>}</section>
        <section className="admin-panel"><h2>Payment</h2>{order.payments.map(payment => <p key={payment.id}><span className={`admin-status ${payment.status}`}>{payment.status}</span><br /><small>{payment.provider} · {money.format(payment.amountCents / 100)}</small></p>)}</section>
      </aside>
    </div>
  </div>;
}

function SnapshotList({ value, label }: { value: unknown; label: string }) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) return null;
  return <dl aria-label={label}>{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key}><dt>{key.replaceAll("-", " ")}</dt><dd>{String(item)}</dd></div>)}</dl>;
}
