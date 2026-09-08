import Link from "next/link";
import { db } from "@/lib/db";

const stages = ["GENERATED", "PROGRAMMED", "VERIFIED", "ASSEMBLED", "READY", "ASSIGNED", "SOLD"] as const;

export default async function ManufacturingPage() {
  const [counts, batches] = await Promise.all([
    Promise.all(stages.map(async status => ({ status, count: await db.nFCTag.count({ where: { manufacturingStatus: status } }) }))),
    db.manufacturingBatch.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { product: { select: { name: true } }, _count: { select: { tags: true } } } }),
  ]);
  return <div><div className="admin-heading"><div><p className="admin-kicker">NFC operations</p><h1>Manufacturing</h1><p>Track every physical unit from generation to sale.</p></div><Link className="button" href="/admin/manufacturing/batches">Create batch</Link></div><div className="manufacturing-stages">{counts.map(item => <article key={item.status}><strong>{item.count}</strong><span>{item.status.replaceAll("_", " ")}</span></article>)}</div><section className="admin-panel"><div className="panel-heading"><div><h2>Recent batches</h2><p>Latest production jobs.</p></div><Link href="/admin/manufacturing/batches">View all</Link></div><div className="compact-list">{batches.map(batch => <Link href={`/admin/manufacturing/batches/${batch.id}`} key={batch.id}><span><strong>{batch.batchNumber}</strong><small>{batch.product.name} · {batch._count.tags} units</small></span><span className={`admin-status ${batch.status}`}>{batch.status}</span></Link>)}</div>{!batches.length && <div className="admin-empty">No manufacturing batches yet.</div>}</section></div>;
}
