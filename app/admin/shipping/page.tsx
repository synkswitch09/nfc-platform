import { PrintAgentRegistration } from "@/components/print-agent-registration";
import { OriginEditor, PackagingEditor, RateEditor } from "@/components/shipping-settings-editors";
import { ShippingProviderToggle } from "@/components/shipping-provider-toggle";
import { ShippingZoneEditor } from "@/components/shipping-zone-editor";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function AdminShippingPage() {
  const { store, storeRole, isPlatformAdmin } = await requireAdminPageContext();
  const [origins, packaging, zones, providers, agents, jobs] = await Promise.all([
    db.shippingOrigin.findMany({ where: { storeId: store.id }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    db.packaging.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" } }),
    db.shippingZone.findMany({ where: { storeId: store.id }, include: { rates: { orderBy: { amountCents: "asc" } } }, orderBy: { priority: "desc" } }),
    db.shippingProvider.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" } }),
    db.printAgent.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } }),
    db.printJob.findMany({ where: { storeId: store.id }, include: { shipment: { select: { trackingNumber: true, order: { select: { orderNumber: true } } } }, printAgent: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const canEdit = isPlatformAdmin || storeRole === "ADMIN";
  return <div>
    <div className="admin-heading"><div><p className="admin-kicker">Sales & fulfilment</p><h1>Shipping</h1><p>Manage dispatch origin, product packages and delivery rates for {store.displayName}.</p></div></div>
    <div className="admin-grid two">
      <section className="admin-panel"><h2>Origin</h2><p className="muted">The default dispatch address used for shipping.</p><div className="shipping-editor-list">{origins.map(origin => <details className="admin-subpanel" key={origin.id} open={origins.length === 1}><summary>{origin.name}{origin.isDefault ? " · Default" : ""}</summary><p className="muted">{origin.line1}, {origin.suburb} {origin.state} {origin.postcode}</p>{canEdit && <OriginEditor origin={origin} />}</details>)}</div>{!origins.length && <p className="admin-empty">No dispatch origin configured.</p>}</section>
      <section className="admin-panel"><h2>Packaging</h2><p className="muted">Choose which boxes and bags are available in product Shipping profiles. Keep the outer box for multi-item orders.</p><div className="shipping-editor-list">{packaging.map(item => <details className="admin-subpanel" key={item.id}><summary>{item.name}{!item.active ? " · Inactive" : ""}</summary><p className="muted">{item.lengthMm} × {item.widthMm} × {item.heightMm} mm · {item.emptyWeightGrams} g empty</p>{canEdit && <PackagingEditor item={item} />}</details>)}</div>{canEdit && <details className="admin-subpanel shipping-add-package"><summary>Add box or bag</summary><PackagingEditor /></details>}</section>
    </div>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Zones and rates</h2><p>Set the delivery area and edit its manual fallback service and price.</p></div></div><div className="shipping-zone-list">{zones.map(zone => <div className="admin-subpanel" key={zone.id}><ShippingZoneEditor zone={zone} /><div className="shipping-editor-list">{zone.rates.map(rate => <details className="admin-subpanel" key={rate.id}><summary>{rate.serviceName} · {(rate.amountCents / 100).toLocaleString("en-AU", { style: "currency", currency: store.currency })}{!rate.active ? " · Inactive" : ""}</summary>{canEdit ? <RateEditor rate={rate} /> : <p className="muted">Rate details are available to store admins.</p>}</details>)}</div></div>)}</div></section>
    <div className="admin-grid two"><section className="admin-panel"><h2>Providers</h2><p className="muted">Enable or disable each source of delivery rates. Manual fallback does not create labels.</p>{providers.map(provider => <ShippingProviderToggle provider={provider} key={provider.id} />)}</section><section className="admin-panel"><h2>Print agents</h2>{agents.map(agent => <p key={agent.id}><strong>{agent.name}</strong><br /><span className="muted">{agent.printerName || "Default printer"} · {agent.lastSeenAt ? `Last seen ${agent.lastSeenAt.toLocaleString("en-AU")}` : "Never connected"}</span></p>)}{canEdit && <PrintAgentRegistration />}</section></div>
    <section className="admin-panel"><h2>Print queue</h2><div className="table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Tracking</th><th>Status</th><th>Agent</th><th>Attempts</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td>{job.shipment.order.orderNumber}</td><td>{job.shipment.trackingNumber}</td><td><span className={`admin-status ${job.status}`}>{job.status}</span></td><td>{job.printAgent?.name ?? "Unclaimed"}</td><td>{job.attempts}</td></tr>)}</tbody></table></div>{!jobs.length && <p className="admin-empty">No labels queued.</p>}</section>
  </div>;
}
