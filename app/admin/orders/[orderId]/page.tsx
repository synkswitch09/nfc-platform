import {AddressCorrectionForm} from "@/components/address-correction-form";
import Link from "next/link";
import { OrderFinancialActions } from "@/components/order-financial-actions";
import { notFound } from "next/navigation";
import { OrderStatusForm } from "@/components/order-status-form";
import { PackingAction } from "@/components/production-actions";
import { ShipmentActions } from "@/components/shipment-actions";
import { ShippitParcels } from "@/components/shippit-parcels";
import { requireAdminPageContext,hasPermission } from "@/lib/admin";
import { db } from "@/lib/db";
import { orderTransitions } from "@/lib/order-status";
import { preparationIssues } from "@/lib/order-preparation";
import { isKeychainProduct } from "@/lib/keychain-order";

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const context = await requireAdminPageContext();
  const { store } = context;
  const order = await db.order.findFirst({
    where: { id: orderId, storeId: store.id },
    include: {
      shippitPreparation: true,
      user: { select: { id: true, name: true, email: true } },
      items: { include: { variant: { select: { product: { select: { slug: true } } } }, manufacturingJobs: { select: { status: true, quantity: true, requiresNfc: true } }, tags: { select: { storeId: true, publicTagId: true, manufacturingStatus: true, status: true } } } },
      payments: { include: { refunds: { orderBy: { createdAt: "desc" } } } },
      supportRequests: { orderBy: { createdAt: "desc" } },
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
        <section className="admin-panel"><div className="panel-heading"><div><h2>Production items</h2><p>These snapshots never change when the catalog is edited.</p></div></div><div className="order-lines">{order.items.map(item => { const production = item.shippingSnapshot && typeof item.shippingSnapshot === "object" && !Array.isArray(item.shippingSnapshot) ? (item.shippingSnapshot as Record<string, unknown>).production as { requiresNfc?: boolean } | undefined : undefined; return <article key={item.id}><div><strong>{item.productName}</strong><span>{item.variantName} · {item.sku} · Qty {item.quantity} · {item.personalisationChoice === "PERSONALISED" ? "Personalised" : "Basic"}</span><SnapshotList value={item.selectedOptions} label="Product options" /><SnapshotList value={item.personalisation} label="Custom details" />{isKeychainProduct(store.slug,item.variant.product.slug) && ["PAID","PROCESSING","READY_TO_SHIP","SHIPPED","DELIVERED"].includes(order.status) && <div className="keychain-downloads"><strong>Print files</strong> {(["model.3mf","base.stl","letters.stl"] as const).map(format=><a key={format} href={`/api/admin/orders/${order.id}/keychain/${item.id}/${format}`}>Download {format}</a>)}<small>Assign filament colours and inspect the slice before printing.</small></div>}<p>Packed {item.packedQuantity}/{item.quantity} · Production: {item.manufacturingJobs.length ? item.manufacturingJobs.map(job => job.status).join(", ") : production ? "Not required" : "Historical requirements missing"}{item.tags.length ? ` · NFC ${item.tags.map(tag => tag.publicTagId).join(", ")}` : ""}</p>{["PAID", "PROCESSING"].includes(order.status) && production && hasPermission(context,"production.write") && <PackingAction orderId={order.id} itemId={item.id} quantity={item.quantity} packedQuantity={item.packedQuantity} requiresNfc={Boolean(production.requiresNfc)} />}</div><strong>{money.format(item.unitPriceCents * item.quantity / 100)}</strong></article>; })}</div><div className="order-totals"><span>Subtotal <strong>{money.format(order.subtotalCents / 100)}</strong></span><span>Shipping <strong>{money.format(order.shippingCents / 100)}</strong></span><span>Discount <strong>-{money.format(order.discountCents / 100)}</strong></span><span>Total <strong>{money.format(order.totalCents / 100)}</strong></span></div></section>
        <section className="admin-panel"><div className="panel-heading"><div><h2>Status history</h2><p>Immutable operational trail.</p></div></div><div className="timeline">{order.statusHistory.map(item => <article key={item.id}><span></span><div><strong>{item.toStatus.replaceAll("_", " ")}</strong><small>{item.createdAt.toLocaleString("en-AU")} · {item.actor?.name ?? "System"}</small>{item.note && <p>{item.note}</p>}</div></article>)}</div></section>
      </div>
      <aside>
        <section className="admin-panel"><h2>Next action</h2>{order.status === "PROCESSING" && <p role="status">{issues.length ? issues.join("; ") : "All lines are prepared for shipping."}</p>}<OrderStatusForm orderId={order.id} options={order.payments.some(payment => payment.status === "REFUNDED") ? [] : (orderTransitions[order.status] ?? []).filter(status => hasPermission(context,"orders.write") && (status!=="CANCELLED" || hasPermission(context,"orders.cancel")) && (!order.shipments.some(item => item.idempotencyKey.startsWith("shippit:")) || !["SHIPPED", "DELIVERED"].includes(status)))} shipping={{ carrier: shipment?.idempotencyKey.startsWith("shippit:") ? shipment.serviceName : order.shippingCarrier, trackingNumber: shipment?.idempotencyKey.startsWith("shippit:") ? shipment.trackingNumber : order.trackingNumber }} canOverride={context.isPlatformAdmin} /></section>
        <section className="admin-panel"><h2>Shipment</h2><ShippitParcels orderId={order.id} parcels={order.shipments.filter(item => item.idempotencyKey.startsWith("shippit:")).map(item => ({ id: item.id, status: item.status, trackingState: item.trackingState, trackingEventAt: item.trackingEventAt?.toISOString() ?? null, serviceName: item.serviceName, trackingNumber: item.trackingNumber, labelStorageKey: item.labelStorageKey, bookedAt: item.bookedAt?.toISOString() ?? null, parcel: item.parcel, idempotencyKey: item.idempotencyKey }))} readyToBook={order.status === "READY_TO_SHIP"} preparation={order.shippitPreparation ? { status: order.shippitPreparation.status, lastError: order.shippitPreparation.lastError } : null} />{order.shipments.filter(item => !item.idempotencyKey.startsWith("shippit:")).map(item => <article key={item.id}><p><strong>{item.serviceName}</strong> · {item.status.replaceAll("_", " ")} · {item.trackingNumber ?? "Tracking pending"}</p>{item.labelStorageKey && <a href={`/api/admin/shipments/${item.id}/document`}>Download label</a>}{item.status === "LABEL_READY" && <ShipmentActions orderId={order.id} shipmentId={item.id} />}</article>)}{!shipment && order.status !== "READY_TO_SHIP" && <p className="muted">Labels will appear here after automatic shipping preparation.</p>}</section>
        <section className="admin-panel"><h2>Ship to</h2>{hasPermission(context,"orders.address")&&<AddressCorrectionForm orderId={order.id} recipient={order.shippingName??order.customerName??""} address={{line1:order.shippingLine1??"",line2:order.shippingLine2,locality:order.shippingLocality??order.shippingSuburb??"",administrativeArea:order.shippingAdministrativeArea??order.shippingState,postcode:order.shippingPostcode??"",country:order.shippingCountry,phone:order.shippingPhone}}/>}<address>{order.shippingName}<br />{order.shippingLine1}<br />{order.shippingLine2 && <>{order.shippingLine2}<br /></>}{order.shippingSuburb}, {order.shippingState} {order.shippingPostcode}<br />{order.shippingCountry}</address>{order.trackingNumber && <p><strong>{order.shippingCarrier}</strong><br /><span className="muted">{order.trackingNumber}</span></p>}</section>
        <section className="admin-panel"><h2>Payment and refunds</h2><p>Preparation / delivery: {order.status.replaceAll("_", " ")}. Refunds do not deactivate tags or automatically return stock.</p>
          {order.payments.map(payment => <div key={payment.id}>
            <p><strong>{payment.provider} · {payment.status}</strong><br />Paid: {money.format(payment.amountCents / 100)} · Refunded: {money.format(payment.refundedAmountCents / 100)}</p>
            {payment.refundedAmountCents > 0 && payment.refundedAmountCents < payment.amountCents && <p role="status">Partial refund — manual review required. This is not a full refund.</p>}
            {hasPermission(context,"finance.refund") && <OrderFinancialActions orderId={order.id} orderNumber={order.orderNumber} amountCents={payment.amountCents} currency={payment.currency} canRefund={hasPermission(context,"finance.refund") && payment.provider === "stripe" && payment.status === "SUCCEEDED" && !payment.refunds.length && payment.amountCents > 0 && Boolean(payment.providerPaymentIntentId)} canRestock={hasPermission(context,"catalog.write") && payment.status === "REFUNDED" && !payment.refundRestockedAt} />}
            {payment.refunds.map(refund => <article key={refund.id}><p>{refund.status} · {money.format(refund.amountCents / 100)}<br />{refund.reason}</p>{refund.lastError && <p role="status">{refund.lastError}</p>}{hasPermission(context,"finance.refund") && <OrderFinancialActions orderId={order.id} orderNumber={order.orderNumber} amountCents={refund.amountCents} currency={refund.currency} refundId={refund.id} />}</article>)}
            {payment.refundRestockedAt && <p>Stock return recorded {payment.refundRestockedAt.toLocaleString("en-AU")}</p>}
          </div>)}
        </section>
        <section className="admin-panel"><h2>Customer requests</h2>{order.supportRequests.map(item => <p key={item.id}><strong>{item.kind.replaceAll("_", " ")}</strong> · {item.status.replaceAll("_", " ")}<br />{item.message}</p>)}{!order.supportRequests.length && <p>No requests.</p>}<Link href="/admin/support">Open support inbox</Link></section>
        <section className="admin-panel"><h2>Notifications</h2><p>Latest 100 notices. Accepted means the email provider accepted the request, not that the recipient received it.</p>
          {!order.notifications.length && <p>No queued notices for this order.</p>}
          {order.notifications.map(notice => <article key={notice.id}><p><strong>{notice.subject}</strong><br />{notice.to}<br />{notice.status} · Attempts: {notice.attempts}</p>{notice.lastError && <p role="status">{notice.lastError}</p>}{hasPermission(context,"finance.refund") && <OrderFinancialActions orderId={order.id} orderNumber={order.orderNumber} amountCents={order.totalCents} currency={order.currency} notificationId={notice.id} />}</article>)}
        </section>
      </aside>
    </div>
  </div>;
}

function SnapshotList({ value, label }: { value: unknown; label: string }) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) return null;
  return <dl aria-label={label}>{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key}><dt>{key.replaceAll("-", " ")}</dt><dd>{typeof item === "object" ? JSON.stringify(item) : String(item)}</dd></div>)}</dl>;
}
