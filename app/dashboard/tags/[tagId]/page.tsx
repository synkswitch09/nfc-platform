import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileEditor } from "@/components/profile-editor";

export default async function TagPage({ params }: { params: Promise<{ tagId: string }> }) {
  const user = await requireUser(); const { tagId } = await params;
  const tag = await db.nFCTag.findFirst({ where: { id: tagId, ownerId: user.id }, include: { profile: { include: { pet: true, child: true, social: true, business: true, luggage: true, contacts: { orderBy: { priority: "asc" } } } }, _count: { select: { scans: true } } } });
  if (!tag?.profile) notFound();
  const origin = process.env.APP_URL ?? "http://localhost:3000"; const publicUrl = `${origin}/t/${tag.publicTagId}`; const qr = await QRCode.toDataURL(publicUrl, { margin: 1, width: 320 });
  const details = tag.profile.pet ?? tag.profile.child ?? tag.profile.social ?? tag.profile.business ?? tag.profile.luggage ?? {};
  return <section className="dashboard"><div className="dashboard-head"><div><Link className="muted" href="/dashboard">← My products</Link><h1>{tag.profile.displayName}</h1><p className="muted">{tag.productType} · <span className={`status ${tag.status}`}>{tag.status}</span> · {tag._count.scans} scans</p></div><Link className="button secondary" href={`/t/${tag.publicTagId}`} target="_blank">View public page</Link></div><div className="grid" style={{gridTemplateColumns:"minmax(0, 1.4fr) minmax(260px, .6fr)"}}><ProfileEditor profile={{ id: tag.id, type: tag.productType, displayName: tag.profile.displayName ?? "My tag", details: JSON.parse(JSON.stringify(details)), contacts: tag.profile.contacts }} /><aside className="card"><h3>QR and tag details</h3><Image src={qr} alt={`QR code for ${publicUrl}`} width={320} height={320} unoptimized style={{width:"100%",height:"auto"}} /><p className="muted">{publicUrl}</p><p><strong>Public Tag ID</strong><br />{tag.publicTagId}</p><p className="muted">The QR and NFC open exactly the same address.</p></aside></div></section>;
}
