import Link from "next/link";
import { notFound } from "next/navigation";
import { ManufacturingStatusForm } from "@/components/manufacturing-status-form";
import { db } from "@/lib/db";
import { manufacturingTransitions } from "@/lib/manufacturing";

export default async function ManufacturingBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId }, include: { product: true, productVariant: true, createdBy: { select: { name: true } }, tags: { orderBy: { batchSequence: "asc" } } } });
  if (!batch) notFound();
  return <div><Link href="/admin/manufacturing/batches" className="admin-back">← Production batches</Link><div className="admin-heading"><div><p className="admin-kicker">Created {batch.createdAt.toLocaleString("en-AU")}</p><h1>{batch.batchNumber}</h1><p>{batch.product.name} · {batch.productVariant?.sku ?? "Generic"} · {batch.createdBy?.name ?? "System"}</p></div><span className={`admin-status large ${batch.status}`}>{batch.status}</span></div>{batch.notes && <p className="notice">{batch.notes}</p>}<section className="admin-panel flush"><div className="admin-table batch-table"><div className="admin-tr admin-th"><span>Unit</span><span>Public tag ID</span><span>Tag state</span><span>Production</span><span>Next action</span></div>{batch.tags.map(tag => <div className="admin-tr" key={tag.id}><strong>#{String(tag.batchSequence).padStart(3, "0")}</strong><Link href={`/admin/tags/${tag.id}`}>{tag.publicTagId}</Link><span className={`admin-status ${tag.status}`}>{tag.status}</span><span className={`admin-status ${tag.manufacturingStatus}`}>{tag.manufacturingStatus}</span><ManufacturingStatusForm tagId={tag.id} next={manufacturingTransitions[tag.manufacturingStatus]?.[0]} /></div>)}</div></section><p className="muted">Activation secrets are never available from batch history. If the original secure sheet is lost before fulfilment, retire these units and create a new batch.</p></div>;
}
