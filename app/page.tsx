import Image from "next/image";
import Link from "next/link";
import { ArrowRight, QrCode, Radio } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/settings";
import { getCurrentStorefront } from "@/lib/storefront";
import { StoreStatus } from "@prisma/client";
import { StoreUnavailable } from "@/components/store-unavailable";

export default async function Home() {
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE) return <StoreUnavailable store={store} />;
  const [settings, categories] = await Promise.all([getStoreSettings(store), process.env.DATABASE_URL ? db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showOnHomepage: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 8 }).catch(() => []) : []]);
  const origin = store.origin;
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": `${origin}/#organization`, name: settings.businessName ?? settings.storeName, url: origin, email: settings.supportEmail, sameAs: Object.values(settings.socialLinks) }, { "@type": "WebSite", "@id": `${origin}/#website`, name: settings.siteTitle, url: origin, publisher: { "@id": `${origin}/#organization` } }] }).replaceAll("<", "\\u003c") }} />
    <section className="hero platform-hero"><div><span className="eyebrow"><Radio size={15} /> {settings.homepage.heroEyebrow}</span><h1>{settings.homepage.heroHeadline}</h1><p className="lead">{settings.homepage.heroDescription}</p><div className="actions"><Link className="button lime" href={settings.homepage.primaryCtaHref}>{settings.homepage.primaryCtaLabel} <ArrowRight size={17} /></Link>{settings.capabilities.includes("NFC") && <Link className="button secondary" href="/activate">Activate a product</Link>}</div></div><div className="tag-visual" aria-label={`${settings.storeName} product illustration`}><div className="physical-tag"><QrCode size={42} /><strong>{settings.storeName.toUpperCase()}</strong><small>Made for everyday use</small></div></div></section>
    <section className="section"><div className="section-head"><span className="eyebrow">Built around real use cases</span><h2>One platform. Many useful connections.</h2><p className="lead">Choose the product that fits the moment. Every category has its own purpose, content and configurable experience.</p></div>{categories.length ? <div className="category-card-grid">{categories.map(category => <Link className="category-card" data-theme={category.visualTheme.toLowerCase()} href={`/${category.slug}`} key={category.id}>{category.cardImageUrl ? <Image src={category.cardImageUrl} alt={category.cardImageAlt ?? ""} width={640} height={420} unoptimized /> : <span className="icon"><CategoryIcon name={category.icon} /></span>}<span className="eyebrow">Smart collection</span><h3>{category.cardTitle ?? category.name}</h3><p>{category.cardText ?? category.shortDescription ?? category.description}</p><strong>Explore {category.name} <ArrowRight size={16} /></strong></Link>)}</div> : <div className="admin-empty">Collections are being prepared. Visit the Shop to see available products.</div>}</section>
    <section className="section" id="how-it-works"><div className="section-head"><span className="eyebrow">Simple by design</span><h2>From idea to one useful tap.</h2></div><div className="grid steps"><article className="card step"><h3>Choose and personalise</h3><p className="muted">Select a product, material, colour and the details you want manufactured.</p></article><article className="card step"><h3>Receive and activate</h3><p className="muted">Your printed product arrives with a separate one-time activation credential.</p></article><article className="card step"><h3>Stay in control</h3><p className="muted">Update the profile, destination or status without reprogramming the NFC chip.</p></article></div></section>
    <section className="section compact-section"><div className="section-head"><span className="eyebrow">Designed for trust</span><h2>Products designed around real life.</h2><p className="lead">Clear materials, thoughtful personalisation and straightforward support from a store that keeps you in control.</p><Link className="button secondary" href="/guides">Explore practical guides <ArrowRight size={17} /></Link></div></section>
  </>;
}
