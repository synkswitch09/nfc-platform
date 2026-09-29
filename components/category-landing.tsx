import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, PackageCheck, Palette, Printer, QrCode, Radio } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { categoryBenefits, categoryFaq, categorySections, categorySteps, categoryUseCases } from "@/lib/category-content";
import { categorySectionOrders } from "@/lib/category-layout";
import type { PublicCategory } from "@/lib/category-query";

export function CategoryLanding({ category, store }: { category: PublicCategory; store: { displayName: string; currency: string; nfcEnabled: boolean } }) {
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const benefits = categoryBenefits(category.benefits);
  const useCases = categoryUseCases(category.useCases);
  const steps = categorySteps(category.howItWorks);
  const stories = categorySections(category.contentSections);
  const faq = categoryFaq(category.faq);
  const products = category.showInShop ? category.products : [];
  const shopHref = `/shop?category=${category.slug}`;

  const sections: Record<string, React.ReactNode> = {
    benefits: benefits.length > 0 && <section className="category-benefits" key="benefits"><SectionHeading eyebrow="Why it matters" title="Designed around the moments that matter." /><div className="benefit-grid">{benefits.map(item => <article key={`${item.order}-${item.title}`}><span className="icon"><CategoryIcon name={item.icon} /></span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></section>,
    "use-cases": useCases.length > 0 && <section className="category-use-cases" key="use-cases"><SectionHeading eyebrow="Made for real life" title={`Where ${category.name} fits in.`} /><div className="use-case-grid">{useCases.map(item => <article key={`${item.order}-${item.title}`}><CategoryIcon name={item.icon} size={28} /><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div></section>,
    steps: steps.length > 0 && <section className="category-steps" key="steps"><SectionHeading eyebrow="Simple. Fast. Useful." title="How it works" /><div className="step-grid">{steps.map((step, index) => <article key={`${step.order}-${step.title}`}><span className="step-number">{index + 1}</span>{step.imageUrl && <Image src={step.imageUrl} alt="" width={560} height={380} unoptimized />}<h3>{step.title}</h3><p>{step.description}</p>{step.ctaLabel && step.ctaHref && <Link href={step.ctaHref}>{step.ctaLabel} <ArrowRight size={15} /></Link>}</article>)}</div></section>,
    stories: stories.map(section => <section className={`category-story ${section.layout.toLowerCase().replaceAll("_", "-")}`} key={`${section.order}-${section.heading}`}><div>{section.eyebrow && <span className="eyebrow">{section.eyebrow}</span>}<h2>{section.heading}</h2><p>{section.copy}</p>{section.bulletPoints.length > 0 && <ul>{section.bulletPoints.map(item => <li key={item}><Check size={18} />{item}</li>)}</ul>}{section.ctaLabel && section.ctaHref && <Link className="button secondary" href={section.ctaHref}>{section.ctaLabel}</Link>}</div>{section.imageUrl && section.layout !== "TEXT_ONLY" ? <Image src={section.imageUrl} alt="" width={760} height={600} unoptimized /> : section.layout !== "TEXT_ONLY" && <VisualPlaceholder icon={category.icon} label={category.name} compact />}</section>),
    products: <section className="category-products" key="products"><SectionHeading eyebrow="Made to be yours" title={`Explore the ${category.name} collection.`} /><div className="shop-grid">{products.map(product => <article className="card product-card" key={product.id}>{product.images[0] ? <Image className="category-product-image" src={product.images[0].url} alt={product.images[0].altText} width={500} height={500} unoptimized /> : <div className="category-product-placeholder"><CategoryIcon name={category.icon} size={34} /><span>Made to order</span></div>}<h3>{product.name}</h3><p>{product.shortDescription ?? product.description}</p>{product.variants[0] && <strong className="price">From {money.format(product.variants[0].priceCents / 100)}</strong>}<Link className="button" href={`/products/${product.slug}`}>View product</Link></article>)}</div>{!products.length && <div className="category-unavailable"><strong>This collection is not accepting new orders right now.</strong><p>Existing purchases and historical records remain available to their owners.</p></div>}<Link className="category-shop-link" href={shopHref}>View the full filtered collection <ArrowRight size={17} /></Link></section>,
    faq: faq.length > 0 && <section className="faq-section category-faq" key="faq"><SectionHeading eyebrow="Helpful answers" title="Frequently asked questions" />{faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>,
  };

  return <section className="category-landing" data-theme={category.visualTheme.toLowerCase()} data-layout={category.landingLayout.toLowerCase()}>
    <nav className="breadcrumbs category-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link><span>/</span><span>{category.name}</span></nav>
    <div className="category-landing-hero"><div className="category-hero-copy"><span className="eyebrow"><CategoryIcon name={category.icon} size={15} /> {category.heroEyebrow ?? `${store.displayName} collection`}</span><h1>{category.heroHeadline ?? category.name}</h1><p className="lead">{category.heroDescription ?? category.shortDescription ?? category.description}</p><div className="actions"><Link className="button category-primary" href={category.ctaHref || shopHref}>{category.ctaLabel ?? `Shop ${category.name}`} <ArrowRight size={17} /></Link>{category.secondaryCtaLabel && category.secondaryCtaHref && <Link className="button secondary" href={category.secondaryCtaHref}>{category.secondaryCtaLabel}</Link>}</div>{store.nfcEnabled ? <div className="category-hero-trust"><span><Radio size={16} /> NFC</span><span><QrCode size={16} /> QR</span><span><Check size={16} /> No app needed</span></div> : <div className="category-hero-trust"><span><Printer size={16} /> 3D printed</span><span><Palette size={16} /> Configurable</span><span><PackageCheck size={16} /> Small batch</span></div>}</div>
      {category.heroImageUrl ? <Image src={category.heroImageUrl} alt={category.heroImageAlt || `${category.name} products`} width={900} height={720} priority unoptimized /> : <VisualPlaceholder icon={category.icon} label={category.name} storeName={store.displayName} nfcEnabled={store.nfcEnabled} />}
    </div>
    {categorySectionOrders[category.landingLayout].map(key => sections[key])}
    {(category.finalCtaHeadline || category.finalCtaLabel) && <section className="category-final-cta"><span className="eyebrow">{category.finalCtaEyebrow ?? "Tap into what matters"}</span><h2>{category.finalCtaHeadline ?? `Discover the ${category.name} collection.`}</h2>{category.finalCtaDescription && <p>{category.finalCtaDescription}</p>}<Link className="button category-primary" href={category.finalCtaHref || shopHref}>{category.finalCtaLabel ?? `Shop ${category.name}`} <ArrowRight size={17} /></Link></section>}
  </section>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="section-head"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>;
}

function VisualPlaceholder({ icon, label, compact = false, storeName = "", nfcEnabled = false }: { icon?: string | null; label: string; compact?: boolean; storeName?: string; nfcEnabled?: boolean }) {
  return <div className={`category-hero-placeholder${compact ? " compact" : ""}`} role="img" aria-label={`${label} collection visual placeholder`}><span className="visual-orbit orbit-one" /><span className="visual-orbit orbit-two" /><div className="smart-object"><CategoryIcon name={icon} size={compact ? 42 : 62} /><strong>{label}</strong><small>{storeName ? `${storeName} · ${nfcEnabled ? "NFC + QR" : "3D printed"}` : "Made to order"}</small></div><div className="visual-note">Personalised<br />Made useful.</div></div>;
}
