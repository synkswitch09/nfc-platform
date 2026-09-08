import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, BriefcaseBusiness, Dog, Luggage, Radio, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { PublicActions } from "@/components/public-actions";
import { rateLimit } from "@/lib/rate-limit";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function deviceCategory(userAgent: string) { return /tablet|ipad/i.test(userAgent) ? "tablet" : /mobile|android|iphone/i.test(userAgent) ? "mobile" : "desktop"; }
function validRedirect(value?: string | null) { try { const url = new URL(value ?? ""); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; } }

export default async function PublicTagPage({ params }: { params: Promise<{ publicTagId: string }> }) {
  const { publicTagId } = await params;
  const tag = await db.nFCTag.findUnique({ where: { publicTagId: publicTagId.toUpperCase() }, include: { profile: { include: { pet: true, child: true, social: true, business: true, luggage: true, contacts: { orderBy: { priority: "asc" } } } } } });
  if (!tag) notFound();
  if (tag.status === "UNCLAIMED" || tag.status === "MANUFACTURED") return <div className="public-profile"><div className="profile-card"><Radio size={38} /><h1 style={{fontSize:"2.5rem"}}>Ready to activate</h1><p className="muted">This TapKind tag has not been linked to an account yet.</p><Link className="button" href={`/activate?tag=${tag.publicTagId}`}>Activate this tag</Link></div></div>;
  if (["DISABLED", "REPLACED"].includes(tag.status) || !tag.profile?.isPublic) return <div className="public-profile"><div className="profile-card"><ShieldCheck size={38} /><h1 style={{fontSize:"2.5rem"}}>Tag unavailable</h1><p className="muted">The owner has disabled this tag. No personal information is available.</p></div></div>;

  const h = await headers(); const now = new Date(); const dayBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const userAgent = h.get("user-agent") ?? ""; const scanIdentity = process.env.TRUST_PROXY === "true" ? h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? "unknown" : userAgent.slice(0, 120);
  void rateLimit("tag-scan", `${tag.id}:${scanIdentity}`, 120, 24 * 60 * 60_000).then(limit => limit.allowed ? db.scanEvent.create({ data: { tagId: tag.id, dayBucket, deviceCategory: deviceCategory(userAgent), countryCode: h.get("cf-ipcountry")?.slice(0,2) || null, region: h.get("cf-region")?.slice(0,80) || null } }) : undefined).catch(() => undefined);
  if (tag.profile.social?.mode === "DIRECT_REDIRECT") { const url = validRedirect(tag.profile.social.redirectUrl); if (url) redirect(url); }

  const profile = tag.profile; const primary = profile.contacts[0]; const lostNotice = tag.status === "LOST" ? <div className="notice"><AlertTriangle size={18} /> This item has been reported lost. Please contact its owner.</div> : null;
  if (profile.pet) return <Shell>{lostNotice}<Dog size={38} /><p className="eyebrow">Pet safety profile</p><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1>{profile.pet.breed && <p className="lead">{profile.pet.breed}{profile.pet.approximateAge ? ` · ${profile.pet.approximateAge}` : ""}</p>}<PublicActions phone={primary?.phone} />{profile.contacts[1] && <a className="button secondary" href={`tel:${profile.contacts[1].phone.replace(/[^+\d]/g, "")}`}>Call secondary contact</a>}{profile.pet.medicalInfo && <Info title="Important medical information" text={profile.pet.medicalInfo} />}{profile.pet.allergies && <Info title="Allergies" text={profile.pet.allergies} />}{profile.pet.behaviourNotes && <Info title="How to approach me" text={profile.pet.behaviourNotes} />}</Shell>;
  if (profile.child) return <Shell>{lostNotice}<ShieldCheck size={38} />{tag.productType === "CHILD" && profile.child.status === "MISSING" && <div className="notice"><AlertTriangle size={18} /> This child is currently reported missing. Please contact their guardian now.</div>}<p className="eyebrow">{tag.productType === "CHILD" ? "Child safety profile" : "Emergency profile"}</p><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1>{profile.child.approximateAge && <p className="lead">Approximate age: {profile.child.approximateAge}</p>}<PublicActions phone={primary?.phone} label={tag.productType === "CHILD" ? "guardian" : "emergency contact"} />{profile.contacts[1] && <a className="button secondary" href={`tel:${profile.contacts[1].phone.replace(/[^+\d]/g, "")}`}>Call secondary contact</a>}{profile.child.criticalMedicalInfo && <Info title="Critical medical information" text={profile.child.criticalMedicalInfo} />}{profile.child.allergies && <Info title="Allergies" text={profile.child.allergies} />}{profile.child.communicationNotes && <Info title="Communication guidance" text={profile.child.communicationNotes} />}</Shell>;
  if (profile.business) return <Shell>{lostNotice}<BriefcaseBusiness size={38} /><p className="eyebrow">Digital contact</p><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1><p className="lead">{profile.business.jobTitle}{profile.business.company ? ` at ${profile.business.company}` : ""}</p>{profile.business.bio && <p>{profile.business.bio}</p>}<PublicActions phone={profile.business.phone} label="contact" />{profile.business.email && <a className="button secondary" href={`mailto:${profile.business.email}`}>Email {profile.displayName}</a>}<a className="button secondary" href={`/t/${tag.publicTagId}/vcard`}>Save contact</a></Shell>;
  if (profile.luggage) return <Shell>{lostNotice}<Luggage size={38} /><p className="eyebrow">Luggage recovery</p><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1><p className="lead">{profile.luggage.message ?? "Thank you for finding this item."}</p><PublicActions phone={profile.luggage.contactPhone} label="owner" /></Shell>;
  const links = profile.social?.links && typeof profile.social.links === "object" ? Object.entries(profile.social.links as Record<string,string>) : [];
  return <Shell>{lostNotice}<Radio size={38} /><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1>{profile.social?.bio && <p className="lead">{profile.social.bio}</p>}<div className="form">{links.map(([label,url]) => validRedirect(url) && <a className="button secondary" href={url} key={label} rel="noopener noreferrer">{label}</a>)}</div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <div className="public-profile"><article className="profile-card">{children}<p className="muted" style={{marginTop:28,fontSize:".82rem"}}>This tag does not contain GPS. Location is shared only when a visitor chooses to share it.</p></article></div>; }
function Info({ title, text }: { title: string; text: string }) { return <section style={{marginTop:20}}><h3>{title}</h3><p className="muted">{text}</p></section>; }
