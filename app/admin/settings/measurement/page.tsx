import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/config";
import { parseIntegrationConfig } from "@/lib/integration-config";
import { measurementAvailability } from "@/lib/measurement";
import { buildMetaCatalog } from "@/lib/meta-catalog";
export default async function MeasurementStatus() {
  const context = await getAdminApiContext("settings.write");
  if (!context) notFound();
  const [counts, recent, feed] = await Promise.all([
    db.measurementDelivery.groupBy({ by: ["provider", "status"], where: { storeId: context.store.id }, _count: true }),
    db.measurementDelivery.findMany({ where: { storeId: context.store.id }, orderBy: { eventTime: "desc" }, take: 25, select: { id: true, provider: true, eventName: true, eventTime: true, status: true, attempts: true, lastError: true } }),
    buildMetaCatalog(context.store),
  ]);
  const ready = measurementAvailability(context.store.slug, parseIntegrationConfig(context.store.integrations));
  return <section className="admin-panel"><Link href="/admin/settings">← Store settings</Link><h1>Measurement & catalog</h1><p>{context.store.displayName} · {getRuntimeConfig().appEnv}</p>
    <p>Provider acceptance does not prove that an event appeared in a report. Confirm Realtime / Events Manager after configuring each provider. GA4 uncertain submissions require review and are not blindly retried.</p>
    <div className="admin-grid">{Object.entries(ready).map(([key, value]) => <div className="card" key={key}><strong>{key.toUpperCase()}</strong><p>{value ? "Ready (visitor consent required for measurement)" : "Inactive or awaiting configuration"}</p></div>)}</div>
    <h2>Catalog</h2><p>{feed ? `${feed.count} published variants · ${feed.skipped} omitted (missing public image or valid price)` : "Feed is disabled in this environment or store."}</p>
    <h2>Server deliveries</h2>{counts.length ? <ul>{counts.map(row => <li key={`${row.provider}:${row.status}`}>{row.provider} · {row.status}: {row._count}</li>)}</ul> : <p>No measurement deliveries yet.</p>}
    <div className="table-wrap"><table><thead><tr><th>Time</th><th>Provider</th><th>Event</th><th>Status</th><th>Attempts</th><th>Detail</th></tr></thead><tbody>{recent.map(row => <tr key={row.id}><td>{row.eventTime.toISOString()}</td><td>{row.provider}</td><td>{row.eventName}</td><td>{row.status}</td><td>{row.attempts}</td><td>{row.lastError || "—"}</td></tr>)}</tbody></table></div>
  </section>;
}
