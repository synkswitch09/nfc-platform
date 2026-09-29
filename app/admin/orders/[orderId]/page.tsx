import Link from "next/link";
import { OrderFinancialActions } from "@/components/order-financial-actions";
import { notFound } from "next/navigation";
import { OrderStatusForm } from "@/components/order-status-form";
import { PackingAction } from "@/components/production-actions";
import { ShipmentActions } from "@/components/shipment-actions";
import { requireAdminPageContext, canManageStore } from "@/lib/admin";
import { db } from "@/lib/db";
import { orderTransitions } from "@/lib/order-status";
import { preparationIssues } from "@/lib/order-preparation";

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const context = await requireAdminPageContext();
  const { store } = context;
  const canManage = canManageStore(context);
  const order = await db.order.findFirst({
    where: { id: orderId, storeId: store.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { include: { manufacturingJobs: { select: { status: true, quantity: true, requiresNfc: true } }, tags: { select: { storeId: true, publicTagId: true, manufacturingStatus: true, status: true } } } },
      payments: { include: { refunds: { orderBy: { createdAt: "desc" } } } },
      notifications: { orderBy: { createdAt: "desc" }, take: 100 },
      shipments: { include: { printJobs: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } },
      statusHistory: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: order.currency });
  const shipment = order.shipments[0];
  const issues = preparationIssues(order.items, store.id);
  return <div>
    <Link href="/admin/orders" className="admin-back">← Orders</Link>
    <div className="admin-heading"><div><p className="admin-kicker">{order.createdAt.toLocaleString("en-AU")}</p><h1>{order.orderNumber}</h1><p>{order.customerName ?? "Customer"} · {order.user?.email ?? order.guestEmail}</p></div><span className={`admin-status large ${order.status}`}>{order.status.replaceAll("_", " ")}</span></div>
    <div className="admin-split order-detail">
      <div>
        <section className="admin-panel"><div className="panel-heading"><div><h2>Production items</h2><p>These snapshots never change when the catalog is edited.</p></div></div><div className="order-lines">{order.items.map(item => { const production = item.shippingSnapshot && typeof item.shippingSnapshot === "object" && !Array.isArray(item.shippingSnapshot) ? (item.shippingSnapshot as Record<string, unknown>).production as { requiresNfc?: boolean } | undefined : undefined; return <article key={item.id}><div><strong>{item.productName}</strong><span>{item.variantName} · {item.sku} · Qty {item.quantity} · {item.personalisationChoice === "PERSONALISED" ? "Personalised" : "Basic"}</span><SnapshotList value={item.selectedOptions} label="Product options" /><SnapshotList value={item.personalisation} label="Custom details" /><p>Packed {item.packedQuantity}/{item.quantity} · Production: {item.manufacturingJobs.length ? item.manufacturingJobs.map(job => job.status).join(", ") : production ? "Not required" : "Historical requirements missing"}{item.tags.length ? ` · NFC ${item.tags.map(tag => tag.publicTagId).join(", ")}` : ""}</p>{["PAID", "PROCESSING"].includes(order.status) && production && <PackingAction orderId={order.id} itemId={item.id} quantity={item.quantity} packedQuantity={item.packedQuantity} requiresNfc={Boolean(production.requiresNfc)} />}</div><strong>{money.format(item.unitPriceCents * item.quantity / 100)}</strong></article>; })}</div><div className="order-totals"><span>Subtotal <strong>{money.format(order.subtotalCents / 100)}</strong></span><span>Shipping <strong>{money.format(order.shippingCents / 100)}</strong></span><span>Total <strong>{money.format(order.totalCents / 100)}</strong></span></div></section>
        <section className="admin-panel"><div className="panel-heading"><div><h2>Status history</h2><p>Immutable operational trail.</p></div></div><div className="timeline">{order.statusHistory.map(item => <article key={item.id}><span></span><div><strong>{item.toStatus.replaceAll("_", " ")}</strong><small>{item.createdAt.toLocaleString("en-AU")} · {item.actor?.name ?? "System"}</small>{item.note && <p>{item.note}</p>}</div></article>)}</div></section>
      </div>
      <aside>
        <section className="admin-panel"><h2>Next action</h2>{order.status === "PROCESSING" && <p role="status">{issues.length ? issues.join("; ") : "All lines are prepared for shipping."}</p>}<OrderStatusForm orderId={order.id} options={order.payments.some(payment => payment.status === "REFUNDED") ? [] : orderTransitions[order.status] ?? []} shipping={{ carrier: order.shippingCarrier, trackingNumber: order.trackingNumber }} canOverride={canManage} /></section>
        <section className="admin-panel"><h2>Shipment</h2>{shipment ? <><p><strong>{shipment.serviceName}</strong><br /><span className="muted">{shipment.status.replaceAll("_", " ")} · {shipment.trackingNumber ?? "Tracking pending"}</span></p>{shipment.status === "LABEL_READY" && <ShipmentActions orderId={order.id} shipmentId={shipment.id} />}<p className="muted">Label: {shipment.labelCreatedAt ? "Ready" : "Pending"} · Print queue: {shipment.printJobs[0]?.status ?? "No job"}</p></> : order.status === "READY_TO_SHIP" ? <ShipmentActions orderId={order.id} /> : <p className="muted">Mark this order ready to ship before creating its label.</p>}</section>
        <section className="admin-panel"><h2>Ship to</h2><address>{order.shippingName}<br />{order.shippingLine1}<br />{order.shippingLine2 && <>{order.shippingLine2}<br /></>}{order.shippingSuburb}, {order.shippingState} {order.shippingPostcode}<br />{order.shippingCountry}</address>{order.trackingNumber && <p><strong>{order.shippingCarrier}</strong><br /><span className="muted">{order.trackingNumber}</span></p>}</section>
        <section className="admin-panel"><h2>Payment and refunds</h2><p>Preparation / delivery: {order.status.replaceAll("_", " ")}. Refunds do not deactivate tags or automatically return stock.</p>
          {order.payments.map(payment => <div key={payment.id}>
            <p><strong>{payment.provider} · {payment.status}</strong><br />Paid: {money.format(payment.amountCents / 100)} · Refunded: {money.format(payment.refundedAmountCents / 100)}</p>
            {payment.refundedAmountCents > 0 && payment.refundedAmountCents < payment.amountCents && <p role="status">Partial refund — manual review required. This is not a full refund.</p>}
            {canManage && <OrderFinancialActions orderId={order.id} orderNumber={order.orderNumber} amountCents={payment.amountCents} currency={payment.currency} canRefund={payment.provider === "stripe" && payment.status === "SUCCEEDED" && !payment.refunds.length && payment.amountCents > 0 && Boolean(payment.providerPaymentIntentId)} canRestock={payment.status === "REFUNDED" && !payment.refundRestockedAt} />}
            {payment.refunds.map(refund => <article key={refund.id}><p>{refund.status} · {money.format(refund.amountCents / 100)}<br />{refund.reason}</p>{refund.lastError && <p role="status">{refund.lastError}</p>}{canManage && <OrderFinancialActions orderId={order.id} orderNumber={order.orderNumber} amountCents={refund.amountCents} currency={refund.currency} refundId={refund.id} />}</article>)}
            {payment.refundRestockedAt && <p>Stock return recorded {payment.refundRestockedAt.toLocaleString("en-AU")}</p>}
          </div>)}
        </section>
        <section className="admin-panel"><h2>Notifications</h2><p>Latest 100 notices. Accepted means the email provider accepted the request, not that the recipient received it.</p>
          {!order.notifications.length && <p>No queued notices for this order.</p>}
          {order.notifications.map(notice => <article key={notice.id}><p><strong>{notice.subject}</strong><br />{notice.to}<br />{notice.status} · Attempts: {notice.attempts}</p>{notice.lastError && <p role="status">{notice.lastError}</p>}{canManage && <OrderFinancialActions orderId={order.id} orderNumber={order.orderNumber} amountCents={order.totalCents} currency={order.currency} notificationId={notice.id} />}</article>)}
        </section>
      </aside>
    </div>
  </div>;
}

function SnapshotList({ value, label }: { value: unknown; label: string }) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) return null;
  return <dl aria-label={label}>{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key}><dt>{key.replaceAll("-", " ")}</dt><dd>{typeof item === "object" ? JSON.stringify(item) : String(item)}</dd></div>)}</dl>;
}
