import { headers } from "next/headers";
import { getRuntimeConfig } from "@/lib/config";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, BriefcaseBusiness, Dog, Luggage, Radio, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { PublicActions } from "@/components/public-actions";
import { rateLimit } from "@/lib/rate-limit";
import type { Metadata } from "next";
import { publicTagState } from "@/lib/catalog-policy";
import { getCurrentStorefront } from "@/lib/storefront";
import type { PetProfileConfig } from "@/lib/pet-profile-cms";
import { petPhotoUrl } from "@/lib/pet-photo-url";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function deviceCategory(userAgent: string) { return /tablet|ipad/i.test(userAgent) ? "tablet" : /mobile|android|iphone/i.test(userAgent) ? "mobile" : "desktop"; }
function validRedirect(value?: string | null) { try { const url = new URL(value ?? ""); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; } }

export default async function PublicTagPage({ params }: { params: Promise<{ publicTagId: string }> }) {
  const { publicTagId } = await params;
  const store = await getCurrentStorefront();
  const tag = await db.nFCTag.findFirst({ where: { storeId: store.id, publicTagId: publicTagId.toUpperCase() }, include: { profile: { include: { pet: true, child: true, social: true, business: true, luggage: true, contacts: { orderBy: { priority: "asc" } } } } } });
  if (!tag) notFound();
  const state = publicTagState(tag.status, tag.profile?.isPublic ?? false);
  if (state === "ACTIVATION") return <div className="public-profile"><div className="profile-card"><Radio size={38} /><h1 style={{fontSize:"2.5rem"}}>Ready to activate</h1><p className="muted">This {store.displayName} product has not been linked to an account yet.</p><Link className="button" href={`/activate?tag=${tag.publicTagId}`}>Activate this product</Link></div></div>;
  if (state === "UNAVAILABLE" || !tag.profile) return <div className="public-profile"><div className="profile-card"><ShieldCheck size={38} /><h1 style={{fontSize:"2.5rem"}}>Tag unavailable</h1><p className="muted">The owner has disabled this tag. No personal information is available.</p></div></div>;

  const h = await headers(); const now = new Date(); const dayBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const userAgent = h.get("user-agent") ?? ""; const scanIdentity = getRuntimeConfig().trustProxy ? h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" : userAgent.slice(0, 120);
  void rateLimit("tag-scan", `${tag.id}:${scanIdentity}`, 120, 24 * 60 * 60_000).then(limit => limit.allowed ? db.scanEvent.create({ data: { tagId: tag.id, dayBucket, deviceCategory: deviceCategory(userAgent), countryCode: h.get("cf-ipcountry")?.slice(0,2) || null, region: h.get("cf-region")?.slice(0,80) || null } }) : undefined).catch(() => undefined);
  if (tag.profile.social?.mode === "DIRECT_REDIRECT") { const url = validRedirect(tag.profile.social.redirectUrl); if (url) redirect(url); }

  const profile = tag.profile; const primary = profile.contacts[0]; const lostNotice = tag.status === "LOST" ? <div className="notice"><AlertTriangle size={18} /> This item has been reported lost. Please contact its owner.</div> : null;
  if (profile.pet) return <PetPublicProfile tag={tag} profile={profile} storeName={store.displayName} config={store.petProfileConfig} />;
  if (profile.child) return <Shell>{lostNotice}<ShieldCheck size={38} />{tag.productType === "CHILD" && profile.child.status === "MISSING" && <div className="notice"><AlertTriangle size={18} /> This child is currently reported missing. Please contact their guardian now.</div>}<p className="eyebrow">{tag.productType === "CHILD" ? "Child safety profile" : "Emergency profile"}</p><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1>{profile.child.approximateAge && <p className="lead">Approximate age: {profile.child.approximateAge}</p>}<PublicActions phone={primary?.phone} storeName={store.displayName} label={tag.productType === "CHILD" ? "guardian" : "emergency contact"} />{profile.contacts[1] && <a className="button secondary" href={`tel:${profile.contacts[1].phone.replace(/[^+\d]/g, "")}`}>Call secondary contact</a>}{profile.child.criticalMedicalInfo && <Info title="Critical medical information" text={profile.child.criticalMedicalInfo} />}{profile.child.allergies && <Info title="Allergies" text={profile.child.allergies} />}{profile.child.communicationNotes && <Info title="Communication guidance" text={profile.child.communicationNotes} />}</Shell>;
  if (profile.business) return <Shell>{lostNotice}<BriefcaseBusiness size={38} /><p className="eyebrow">Digital contact</p><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1><p className="lead">{profile.business.jobTitle}{profile.business.company ? ` at ${profile.business.company}` : ""}</p>{profile.business.bio && <p>{profile.business.bio}</p>}<PublicActions phone={profile.business.phone} storeName={store.displayName} label="contact" />{profile.business.email && <a className="button secondary" href={`mailto:${profile.business.email}`}>Email {profile.displayName}</a>}<a className="button secondary" href={`/t/${tag.publicTagId}/vcard`}>Save contact</a></Shell>;
  if (profile.luggage) return <Shell>{lostNotice}<Luggage size={38} /><p className="eyebrow">Luggage recovery</p><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1><p className="lead">{profile.luggage.message ?? "Thank you for finding this item."}</p><PublicActions phone={profile.luggage.contactPhone} storeName={store.displayName} label="owner" /></Shell>;
  const links = profile.social?.links && typeof profile.social.links === "object" ? Object.entries(profile.social.links as Record<string,string>) : [];
  return <Shell>{lostNotice}<Radio size={38} /><h1 style={{fontSize:"3.2rem"}}>{profile.displayName}</h1>{profile.social?.bio && <p className="lead">{profile.social.bio}</p>}<div className="form">{links.map(([label,url]) => validRedirect(url) && <a className="button secondary" href={url} key={label} rel="noopener noreferrer">{label}</a>)}</div></Shell>;
}

type PublicPetProfile = { displayName: string | null; contacts: Array<{ name: string; relationship: string | null; phone: string }>; pet: { photoUrl: string | null; species: string | null; breed: string | null; sex: string | null; approximateAge: string | null; description: string | null; medicalInfo: string | null; allergies: string | null; medications: string | null; behaviourNotes: string | null; veterinarian: string | null } | null };

function PetPublicProfile({ tag, profile, storeName, config }: { tag: { status: string }; profile: PublicPetProfile; storeName: string; config: PetProfileConfig }) {
  if (!profile?.pet) return null;
  const pet = profile.pet;
  const primary = profile.contacts[0];
  const identity = [["Species", pet.species], ["Breed", pet.breed], ["Age", pet.approximateAge], ["Sex", pet.sex]].filter(([, value]) => Boolean(value));
  const urgent = [["Medical information", pet.medicalInfo], ["Allergies", pet.allergies], ["Medication", pet.medications]].filter(([, value]) => Boolean(value));
  const style = { "--pet-hero-start": config.heroStartColour, "--pet-hero-end": config.heroEndColour, "--pet-page-background": config.pageBackgroundColour, "--pet-card-background": config.cardBackgroundColour, "--pet-contact-background": config.contactBackgroundColour, "--pet-accent": config.accentColour, "--pet-lost-background": config.lostBackgroundColour, "--pet-name-size": `${config.nameSizePx}px`, "--pet-body-size": `${config.bodySizePx}px` } as React.CSSProperties;
  return <Shell className="pet-public-profile" style={style} disclaimer={config.gpsDisclaimer}><article className="pet-profile-hero">
    <div className="pet-profile-topline"><span><Dog size={16} /> {config.brandLabel}</span><span className={`pet-profile-status ${tag.status === "LOST" ? "lost" : "safe"}`}>{tag.status === "LOST" ? config.lostStatusLabel : config.profileLabel}</span></div>
    <div className="pet-profile-identity">
      {pet.photoUrl && petPhotoUrl(pet.photoUrl) ? <img className="pet-profile-photo" src={petPhotoUrl(pet.photoUrl)} alt={`Photo of ${profile.displayName}`} /> : <div className="pet-profile-photo pet-profile-photo-placeholder" aria-label="No pet photo"><Dog size={50} /></div>}
      <div><p className="eyebrow">{tag.status === "LOST" ? config.lostGreeting : config.greeting}</p><h1>{profile.displayName}</h1>{pet.breed && <p className="pet-profile-breed">{pet.breed}</p>}</div>
    </div>
    {tag.status === "LOST" && <div className="pet-lost-message"><AlertTriangle size={19} /><span>{config.lostMessage}</span></div>}
  </article>
  <section className="pet-profile-content" aria-label={`${profile.displayName} details`}>
    {identity.length > 0 && <dl className="pet-profile-facts">{identity.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {pet.description && <Info title={`${config.aboutLabel} ${profile.displayName}`} text={pet.description} />}
    <section className="pet-contact-card"><div><p className="eyebrow">{config.contactEyebrow}</p><h2>{config.contactHeading}</h2>{primary?.name && <p className="muted">{config.primaryContactLabel}: {primary.name}{primary.relationship ? ` · ${primary.relationship}` : ""}</p>}</div><PublicActions phone={primary?.phone} storeName={storeName} /></section>
    {profile.contacts[1] && <a className="button secondary pet-secondary-contact" href={`tel:${profile.contacts[1].phone.replace(/[^+\d]/g, "")}`}>Call {profile.contacts[1].name || "secondary contact"}</a>}
    {urgent.length > 0 && <section className="pet-urgent-card"><div className="pet-urgent-title"><AlertTriangle size={19} /><h2>{config.careHeading}</h2></div>{urgent.map(([title, text]) => <Info key={String(title)} title={String(title)} text={String(text)} />)}</section>}
    {pet.behaviourNotes && <Info title={config.approachHeading} text={pet.behaviourNotes} />}
    {pet.veterinarian && <Info title={config.veterinarianHeading} text={pet.veterinarian} />}
  </section></Shell>;
}

function Shell({ children, className = "", style, disclaimer = "This tag does not contain GPS. Location is shared only when a visitor chooses to share it." }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; disclaimer?: string }) { return <div className={`public-profile ${className}`} style={style}><article className="profile-card">{children}<p className="profile-disclaimer">{disclaimer}</p></article></div>; }
function Info({ title, text }: { title: string; text: string }) { return <section className="profile-info"><h3>{title}</h3><p>{text}</p></section>; }
