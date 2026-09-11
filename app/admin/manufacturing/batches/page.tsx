import Link from "next/link";
import { BatchGenerator } from "@/components/batch-generator";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";

export default async function ManufacturingBatchesPage() {
  const { store } = await requireAdminPageContext();
  const [products, batches] = await Promise.all([
    db.product.findMany({ where: { storeId: store.id, status: { in: ["ACTIVE", "DRAFT"] }, type: { not: "ACCESSORY" } }, select: { id: true, name: true, variants: { where: { active: true }, select: { id: true, name: true, sku: true } } }, orderBy: { name: "asc" } }),
    db.manufacturingBatch.findMany({ where: { storeId: store.id }, take: 100, orderBy: { createdAt: "desc" }, include: { product: { select: { name: true } }, productVariant: { select: { name: true, sku: true } }, createdBy: { select: { name: true } }, _count: { select: { tags: true } } } }),
  ]);
  return <div><div className="admin-heading"><div><p className="admin-kicker">NFC operations</p><h1>Production batches</h1><p>Generate unique credentials, QR labels and traceable units.</p></div></div><div className="admin-split batch-layout"><section><BatchGenerator products={products} /></section><section className="admin-panel"><div className="panel-heading"><div><h2>Batch history</h2><p>Secrets are intentionally not retained.</p></div></div><div className="compact-list">{batches.map(batch => <Link href={`/admin/manufacturing/batches/${batch.id}`} key={batch.id}><span><strong>{batch.batchNumber}</strong><small>{batch.product.name} · {batch.productVariant?.sku ?? "No variant"} · {batch.createdAt.toLocaleDateString("en-AU")}</small></span><span><strong>{batch._count.tags}</strong><small>{batch.status}</small></span></Link>)}</div>{!batches.length && <div className="admin-empty">Create the first secure batch.</div>}</section></div></div>;
}
