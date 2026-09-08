import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Dog, QrCode, Share2, ShieldCheck } from "lucide-react";
import { getStoreSettings } from "@/lib/settings";

const products = [
  { icon: Dog, name: "Pet Tag", copy: "Help a finder contact you quickly, with the medical details that matter.", price: "$24" },
  { icon: ShieldCheck, name: "Child Safety Tag", copy: "A privacy-first emergency profile controlled by a guardian.", price: "$27" },
  { icon: Share2, name: "Social Tag", copy: "Share one profile or redirect straight to your favourite social account.", price: "$19" },
  { icon: BriefcaseBusiness, name: "Business Tag", copy: "A polished digital contact card with a downloadable vCard.", price: "$29" },
];

export default async function Home() {
  const settings = await getStoreSettings();
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": `${origin}/#organization`, name: settings.businessName ?? settings.storeName, url: origin, email: settings.supportEmail, sameAs: Object.values(settings.socialLinks) }, { "@type": "WebSite", "@id": `${origin}/#website`, name: settings.siteTitle, url: origin, publisher: { "@id": `${origin}/#organization` } }] }).replaceAll("<", "\\u003c") }} />
    <section className="hero">
      <div>
        <span className="eyebrow"><ShieldCheck size={15} /> Privacy-first by design</span>
        <h1>One tap.<br />A safer connection.</h1>
        <p className="lead">Smart NFC products that connect people to the right information—without storing personal details on the tag itself.</p>
        <div className="actions"><Link className="button lime" href="/shop">Shop tags <ArrowRight size={17} /></Link><Link className="button secondary" href="/activate">Activate a tag</Link></div>
      </div>
      <div className="tag-visual" aria-label="Illustration of a TapKind pet tag">
        <div className="physical-tag"><QrCode size={42} /><strong>MAX</strong><small>Tap or scan to help me home</small></div>
      </div>
    </section>
    <section className="section">
      <div className="section-head"><span className="eyebrow">Made for real life</span><h2>A useful tag for every connection.</h2><p className="lead">Update the destination any time. The NFC product never needs to be reprogrammed.</p></div>
      <div className="grid">{products.map(({ icon: Icon, name, copy, price }) => <article className="card product-card" key={name}><span className="icon"><Icon /></span><h3>{name}</h3><p>{copy}</p><span className="price">From {price} AUD</span></article>)}</div>
    </section>
    <section className="section" id="how-it-works">
      <div className="section-head"><span className="eyebrow">Simple by design</span><h2>From delivery to first tap.</h2></div>
      <div className="grid steps"><article className="card step"><h3>Choose your product</h3><p className="muted">Select a colour and add the name or wording you want printed.</p></article><article className="card step"><h3>Activate securely</h3><p className="muted">Sign in and enter the separate code supplied with your product.</p></article><article className="card step"><h3>Change it any time</h3><p className="muted">Edit the public profile or destination without touching the NFC tag.</p></article></div>
    </section>
    <section className="section compact-section"><div className="section-head"><span className="eyebrow">Learn before you tap</span><h2>Practical NFC guides.</h2><p className="lead">Clear advice about smart tags, privacy and what information helps in an emergency.</p><Link className="button secondary" href="/guides">Explore the guides <ArrowRight size={17} /></Link></div></section>
  </>;
}
