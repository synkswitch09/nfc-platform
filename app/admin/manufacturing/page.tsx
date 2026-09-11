import Link from "next/link";
import { notFound } from "next/navigation";
import { ManufacturingJobStatus, StoreCapability } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";
import { hasStoreCapability } from "@/lib/storefront";

const stages = Object.values(ManufacturingJobStatus);

export default async function ManufacturingPage() {
  const { store } = await requireAdminPageContext();
  if (!hasStoreCapability(store, StoreCapability.PRINT_3D)) notFound();
  const [grouped, jobs] = await Promise.all([
    db.manufacturingJob.groupBy({ by: ["status"], where: { storeId: store.id }, _count: { _all: true } }),
    db.manufacturingJob.findMany({ where: { storeId: store.id }, take: 30, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], include: { orderItem: { include: { order: { select: { id: true, orderNumber: true } } } }, productVariant: { select: { sku: true, name: true, product: { select: { name: true } } } } } }),
  ]);
  const countByStatus = new Map(grouped.map(item => [item.status, item._count._all]));
  return <div><div className="admin-heading"><div><p className="admin-kicker">Manufacturing · {store.displayName}</p><h1>Production queue</h1><p>Generic 3D print, finishing, QA, assembly and packing work by order item.</p></div></div>
    <div className="manufacturing-job-stages">{stages.map(status => <article key={status}><strong>{countByStatus.get(status) ?? 0}</strong><span>{status.replaceAll("_", " ")}</span></article>)}</div>
    <section className="admin-panel flush"><div className="admin-table manufacturing-job-table"><div className="admin-tr admin-th"><span>Product</span><span>Order</span><span>Material</span><span>Work</span><span>Status</span></div>{jobs.map(job => <div className="admin-tr" key={job.id}><span><strong>{job.productVariant.product.name}</strong><small>{job.productVariant.sku} · {job.productVariant.name} · Qty {job.quantity}</small></span><span><Link className="text-link" href={`/admin/orders/${job.orderItem.order.id}`}>{job.orderItem.order.orderNumber}</Link></span><span>{job.material ?? "Not specified"}<small>{job.colour ?? "No colour"}</small></span><span>{job.requiresNfc ? "3D + NFC" : "3D print"}<small>Priority {job.priority}</small></span><span className={`admin-status ${job.status}`}>{job.status.replaceAll("_", " ")}</span></div>)}</div>{!jobs.length && <div className="admin-empty">Paid 3D-print order items will appear here automatically.</div>}</section>
    {hasStoreCapability(store, StoreCapability.NFC) && <section className="admin-panel"><div className="panel-heading"><div><h2>NFC identity production</h2><p>NFC generation and programming remain a separate, specialised workflow.</p></div><Link href="/admin/manufacturing/batches">Open NFC production batches</Link></div></section>}
  </div>;
}
