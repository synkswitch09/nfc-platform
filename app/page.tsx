import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, Package, QrCode, Radio } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/settings";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import { StoreCapability, StoreStatus } from "@prisma/client";
import { StoreUnavailable } from "@/components/store-unavailable";

export default async function Home() {
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE) return <StoreUnavailable store={store} />;
  const [settings, categories] = await Promise.all([getStoreSettings(store), process.env.DATABASE_URL ? db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showOnHomepage: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 8 }).catch(() => []) : []]);
  const origin = store.origin;
  const nfcEnabled = hasStoreCapability(store, StoreCapability.NFC);
  const story = nfcEnabled ? {
    eyebrow: "Built around real use cases", headline: "One platform. Many useful connections.", description: "Choose the product that fits the moment. Every category has its own purpose, content and configurable experience.",
    steps: [["Choose and personalise", "Select a product, material, colour and the details you want manufactured."], ["Receive and activate", "Your printed product arrives with a separate one-time activation credential."], ["Stay in control", "Update the profile, destination or status without reprogramming the NFC chip."]],
    closing: "Products designed around real life.", closingCopy: "Clear materials, thoughtful personalisation and straightforward support from a store that keeps you in control.",
  } : {
    eyebrow: "Made to settle into real life", headline: "Useful forms for calmer everyday spaces.", description: "Explore purpose-built objects designed around desks, organisation and the routines that happen every day.",
    steps: [["Choose a useful form", "Start with an everyday problem and select the size, finish and colour that fits."], ["Made in small batches", "Your product moves through 3D printing, finishing and practical quality checks."], ["Put it straight to work", "Unpack a durable object designed for a clear job and a considered space."]],
    closing: "Small objects. Noticeably better routines.", closingCopy: "Thoughtful proportions, useful materials and straightforward support from design through delivery.",
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": `${origin}/#organization`, name: settings.businessName ?? settings.storeName, url: origin, email: settings.supportEmail, sameAs: Object.values(settings.socialLinks) }, { "@type": "WebSite", "@id": `${origin}/#website`, name: settings.siteTitle, url: origin, publisher: { "@id": `${origin}/#organization` } }] }).replaceAll("<", "\\u003c") }} />
    <section className="hero platform-hero"><div><span className="eyebrow">{nfcEnabled ? <Radio size={15} /> : <Package size={15} />} {settings.homepage.heroEyebrow}</span><h1>{settings.homepage.heroHeadline}</h1><p className="lead">{settings.homepage.heroDescription}</p><div className="actions"><Link className="button lime" href={settings.homepage.primaryCtaHref}>{settings.homepage.primaryCtaLabel} <ArrowRight size={17} /></Link>{nfcEnabled && <Link className="button secondary" href="/activate">Activate a product</Link>}</div></div>{nfcEnabled ? <div className="tag-visual" aria-label={`${settings.storeName} connected product illustration`}><div className="physical-tag"><QrCode size={42} /><strong>{settings.storeName.toUpperCase()}</strong><small>Made for everyday use</small></div></div> : <div className="product-forms-visual" aria-label={`${settings.storeName} organised product forms`}><div><Package size={46} /><strong>Designed</strong></div><div><Boxes size={46} /><strong>Made</strong></div></div>}</section>
    <section className="section"><div className="section-head"><span className="eyebrow">{story.eyebrow}</span><h2>{story.headline}</h2><p className="lead">{story.description}</p></div>{categories.length ? <div className="category-card-grid">{categories.map(category => <Link className="category-card" data-theme={category.visualTheme.toLowerCase()} href={`/${category.slug}`} key={category.id}>{category.cardImageUrl ? <Image src={category.cardImageUrl} alt={category.cardImageAlt ?? ""} width={640} height={420} unoptimized /> : <span className="icon"><CategoryIcon name={category.icon} /></span>}<span className="eyebrow">Collection</span><h3>{category.cardTitle ?? category.name}</h3><p>{category.cardText ?? category.shortDescription ?? category.description}</p><strong>Explore {category.name} <ArrowRight size={16} /></strong></Link>)}</div> : <div className="admin-empty">Collections are being prepared. Visit the Shop to see available products.</div>}</section>
    <section className="section" id="how-it-works"><div className="section-head"><span className="eyebrow">Simple by design</span><h2>{nfcEnabled ? "From idea to one useful tap." : "From useful idea to finished object."}</h2></div><div className="grid steps">{story.steps.map(([title, description]) => <article className="card step" key={title}><h3>{title}</h3><p className="muted">{description}</p></article>)}</div></section>
    <section className="section compact-section"><div className="section-head"><span className="eyebrow">Designed for trust</span><h2>{story.closing}</h2><p className="lead">{story.closingCopy}</p><Link className="button secondary" href={nfcEnabled ? "/guides" : "/shop"}>{nfcEnabled ? "Explore practical guides" : "Explore the collection"} <ArrowRight size={17} /></Link></div></section>
  </>;
}
