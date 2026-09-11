import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ActivationCodeRegenerator } from "@/components/activation-code-regenerator";
import { AdminTagStatusForm } from "@/components/admin-tag-status-form";
import { ManufacturingStatusForm } from "@/components/manufacturing-status-form";
import { db } from "@/lib/db";
import { manufacturingTransitions } from "@/lib/manufacturing";
import { requireAdminPageContext } from "@/lib/admin";
import { StoreCapability } from "@prisma/client";
import { hasStoreCapability } from "@/lib/storefront";

const statusTransitions = { MANUFACTURED: ["DISABLED", "REPLACED"], UNCLAIMED: ["DISABLED", "REPLACED"], ACTIVE: ["DISABLED", "LOST", "REPLACED"], DISABLED: ["ACTIVE", "REPLACED"], LOST: ["ACTIVE", "REPLACED"], REPLACED: [] };

export default async function AdminTagPage({ params }: { params: Promise<{ tagId: string }> }) {
  const { tagId } = await params;
  const { user: actor, store } = await requireAdminPageContext();
  if (!hasStoreCapability(store, StoreCapability.NFC)) notFound();
  const [tag, auditEvents] = await Promise.all([
    db.nFCTag.findFirst({ where: { id: tagId, storeId: store.id }, include: { product: { include: { category: true } }, productVariant: true, owner: { select: { id: true, name: true, email: true } }, orderItem: { include: { order: true } }, manufacturingBatch: true, profile: { select: { displayName: true, isPublic: true } }, activations: { take: 20, orderBy: { attemptedAt: "desc" } }, scans: { take: 20, orderBy: { scannedAt: "desc" } }, _count: { select: { scans: true, activations: true } } } }),
    db.auditLog.findMany({ where: { storeId: store.id, entityType: "NFCTag", entityId: tagId }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  if (!tag) notFound();
  const publicUrl = `${store.origin}/t/${tag.publicTagId}`; const qr = await QRCode.toDataURL(publicUrl, { width: 260, margin: 1, errorCorrectionLevel: "M" }); const locked = Boolean(tag.activationLockedUntil && tag.activationLockedUntil > new Date());
  return <div><Link href="/admin/tags" className="admin-back">← Tags</Link><div className="admin-heading"><div><p className="admin-kicker">{tag.product.name} · {tag.productVariant?.sku ?? tag.productType}</p><h1>{tag.publicTagId}</h1><p>Created {tag.createdAt.toLocaleString("en-AU")} · {tag._count.scans} scans</p></div><span className={`admin-status large ${tag.status}`}>{tag.status}</span></div><div className="admin-split tag-detail"><div>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Tag identity</h2><p>The tag lifecycle—not category or product visibility—controls operation.</p></div></div><dl className="detail-grid"><div><dt>Public tag ID</dt><dd>{tag.publicTagId}</dd></div><div><dt>Profile type</dt><dd>{tag.productType}</dd></div><div><dt>Product</dt><dd><Link href={`/admin/products/${tag.productId}`}>{tag.product.name}</Link></dd></div><div><dt>Category</dt><dd>{tag.product.category ? <Link href={`/admin/categories/${tag.product.category.id}`}>{tag.product.category.name}</Link> : "Uncategorised"}</dd></div><div><dt>Variant / SKU</dt><dd>{tag.productVariant ? `${tag.productVariant.name} · ${tag.productVariant.sku}` : "No variant"}</dd></div><div><dt>Activated</dt><dd>{tag.activatedAt?.toLocaleString("en-AU") ?? "Not activated"}</dd></div></dl></section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Manufacturing trail</h2><p>Current stage: {tag.manufacturingStatus}</p></div></div><div className="manufacturing-dates"><span>Generated<strong>{tag.createdAt.toLocaleString("en-AU")}</strong></span><span>Programmed<strong>{tag.programmedAt?.toLocaleString("en-AU") ?? "Pending"}</strong></span><span>Verified<strong>{tag.verifiedAt?.toLocaleString("en-AU") ?? "Pending"}</strong></span><span>Assembled<strong>{tag.assembledAt?.toLocaleString("en-AU") ?? "Pending"}</strong></span></div><ManufacturingStatusForm tagId={tag.id} next={manufacturingTransitions[tag.manufacturingStatus]?.[0]} />{tag.manufacturingBatch && <p><Link className="text-link left" href={`/admin/manufacturing/batches/${tag.manufacturingBatch.id}`}>View batch {tag.manufacturingBatch.batchNumber}</Link></p>}</section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Recent scans</h2><p>Coarse, privacy-preserving diagnostics only.</p></div></div><div className="compact-list">{tag.scans.map(scan => <article className="scan-row" key={String(scan.id)}><span>{scan.scannedAt.toLocaleString("en-AU")}</span><span>{scan.deviceCategory ?? "Unknown device"}</span><span>{[scan.region, scan.countryCode].filter(Boolean).join(", ") || "Location unavailable"}</span></article>)}</div>{!tag.scans.length && <div className="admin-empty">No scans recorded.</div>}</section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Security and audit</h2><p>Critical tag actions with actor and timestamp. Secrets are never logged.</p></div></div><div className="compact-list">{auditEvents.map(event => <article className="audit-row" key={String(event.id)}><span><strong>{event.action.replaceAll("_", " ")}</strong><small>{event.actor?.name ?? "System"} · {event.actor?.email ?? "automated"}</small></span><time>{event.createdAt.toLocaleString("en-AU")}</time></article>)}</div>{!auditEvents.length && <div className="admin-empty">No audit events for this tag.</div>}</section>
  </div><aside>
    <section className="admin-panel tag-qr"><Image src={qr} alt={`QR for ${tag.publicTagId}`} width={260} height={260} unoptimized /><a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a><p className="muted">QR and NFC resolve to the same permanent public URL.</p></section>
    <section className="admin-panel"><h2>Owner verification</h2>{tag.owner ? <p><Link href={`/admin/customers/${tag.owner.id}`}><strong>{tag.owner.name}</strong><br />{tag.owner.email}</Link></p> : <p className="muted">Not yet claimed.</p>}<p>Profile: {tag.profile?.displayName ?? "Not created"}</p>{tag.orderItem ? <p><Link href={`/admin/orders/${tag.orderItem.order.id}`}><strong>Order {tag.orderItem.order.orderNumber}</strong><br />{tag.orderItem.productName} · {tag.orderItem.sku}</Link></p> : <p className="muted">No order linked to this unit.</p>}</section>
    <section className="admin-panel"><h2>Activation</h2><dl className="detail-grid compact"><div><dt>Credential</dt><dd>••••••••••••</dd></div><div><dt>Version</dt><dd>{tag.activationCodeVersion}</dd></div><div><dt>Attempts</dt><dd>{tag._count.activations}</dd></div><div><dt>Lock status</dt><dd>{locked ? `Locked until ${tag.activationLockedUntil!.toLocaleString("en-AU")}` : "Not locked"}</dd></div></dl>{actor?.role === "ADMIN" ? <ActivationCodeRegenerator tagId={tag.id} eligible={["MANUFACTURED", "UNCLAIMED"].includes(tag.status)} /> : <p className="muted">Only administrators can regenerate credentials.</p>}</section>
    <section className="admin-panel"><h2>Tag controls</h2><p className="muted">Every change requires a reason and is written to the audit log.</p><AdminTagStatusForm tagId={tag.id} options={statusTransitions[tag.status]} /></section>
  </aside></div></div>;
}
