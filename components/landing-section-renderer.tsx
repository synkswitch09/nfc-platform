import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, PackageCheck, Palette, Printer, QrCode, Radio } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { parseLandingContent } from "@/lib/landing-sections";
import type { PublicCategory } from "@/lib/category-query";

type Item = { icon?: string; title?: string; description?: string; supportingText?: string; imageUrl?: string; imageAlt?: string; ctaLabel?: string; ctaHref?: string; backgroundColour?: string; iconBackgroundColour?: string; iconColour?: string; imagePosition?: number; visible?: boolean; order?: number };
type Feature = { icon?: string; label?: string; supportingText?: string; backgroundColour?: string; iconColour?: string; visible?: boolean; order?: number };
type TextBlock = { type?: string; text?: string; visible?: boolean; order?: number };
type FaqItem = { question?: string; answer?: string; visible?: boolean; order?: number };

export function LandingSectionRenderer({ category, store }: { category: PublicCategory; store: { displayName: string; currency: string; nfcEnabled: boolean } }) {
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const shopHref = `/shop?category=${category.slug}`;
  return <main className="category-landing modular-landing" data-theme={category.visualTheme.toLowerCase()}>
    <nav className="breadcrumbs category-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link><span>/</span><span>{category.name}</span></nav>
    {category.landingSections.map(section => {
      const value = parseLandingContent(section.type, section.content);
      if (!value) return null;
      const common = readCommon(value, section.name);
      const sectionStyle = surfaceStyle(value);

      if (section.type === "HERO") {
        const features = ordered<Feature>(value.features);
        const textBlocks = ordered<TextBlock>(value.textBlocks);
        return <section className="category-landing-hero modular-hero" style={sectionStyle} key={section.id}>
          <div className="category-hero-copy">
            <SectionCopy {...common} fallbackHeadline={category.heroHeadline || category.name} fallbackCopy={category.heroDescription || category.description || ""} textBlocks={textBlocks} />
            <SectionActions value={value} fallbackHref={shopHref} />
            {features.length ? <div className="modular-hero-features">{features.map((feature, index) => <div key={`${feature.label}-${index}`}><span style={{ backgroundColor: colour(feature.backgroundColour), color: colour(feature.iconColour) }}><CategoryIcon name={feature.icon} size={20} /></span><small>{feature.label}</small>{feature.supportingText && <em>{feature.supportingText}</em>}</div>)}</div> : <div className="category-hero-trust">{store.nfcEnabled ? <><span><Radio size={16} /> NFC</span><span><QrCode size={16} /> QR</span><span><Check size={16} /> No app needed</span></> : <><span><Printer size={16} /> 3D printed</span><span><Palette size={16} /> Configurable</span><span><PackageCheck size={16} /> Small batch</span></>}</div>}
          </div>
          <SectionImage url={common.imageUrl} alt={common.imageAlt || `${category.name} products`} priority placeholder={<CategoryPlaceholder category={category} storeName={store.displayName} />} />
        </section>;
      }

      if (["BENEFITS", "FEATURE_BADGES", "FEATURE_LIST", "TRUST_STRIP", "STATS", "STORY_PROCESS", "STEPS"].includes(section.type)) {
        const items = ordered<Item>(value.items);
        const className = section.type === "STEPS" ? "modular-steps" : section.type === "STORY_PROCESS" ? "modular-story-process" : `modular-${section.type.toLowerCase().replaceAll("_", "-")}`;
        return <section className={`category-benefits ${className}`} style={sectionStyle} key={section.id}>
          <Heading eyebrow={common.eyebrow} headline={common.headline} copy={common.copy} />
          <div className={section.type === "STEPS" ? "step-grid" : "benefit-grid"}>{items.map((item, index) => <article style={{ backgroundColor: colour(item.backgroundColour) }} key={`${item.title}-${index}`}>
            {item.imageUrl && <div className="modular-item-image" style={{ translate: `0 ${number(item.imagePosition)}px` }}><Image src={item.imageUrl} alt={item.imageAlt || ""} width={560} height={380} unoptimized /></div>}
            <span className={section.type === "STEPS" ? "step-number" : "icon"} style={{ backgroundColor: colour(item.iconBackgroundColour), color: colour(item.iconColour) }}>{section.type === "STEPS" ? index + 1 : <CategoryIcon name={item.icon} />}</span>
            <div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.supportingText && <small>{item.supportingText}</small>}{item.ctaLabel && item.ctaHref && <Link href={item.ctaHref}>{item.ctaLabel}</Link>}</div>
          </article>)}</div>
          <SectionActions value={value} fallbackHref={shopHref} />
        </section>;
      }

      if (["PRODUCT_SHOWCASE", "PRODUCT_GRID"].includes(section.type)) {
        const limit = number(value.limit, 6);
        const products = category.products.filter(product => !value.featuredOnly || product.featured).slice(0, limit);
        return <section className="category-products" style={sectionStyle} key={section.id}><Heading eyebrow={common.eyebrow} headline={common.headline} copy={common.copy} /><div className="shop-grid">{products.map(product => <article className="card product-card" key={product.id}>{product.images[0] ? <Image className="category-product-image" src={product.images[0].url} alt={product.images[0].altText} width={500} height={500} unoptimized /> : <div className="category-product-placeholder"><CategoryIcon name={category.icon} /><span>Made to order</span></div>}<h3>{product.name}</h3><p>{product.shortDescription ?? product.description}</p>{product.variants[0] && <strong className="price">From {money.format(product.variants[0].priceCents / 100)}</strong>}<Link className="button" href={`/products/${product.slug}`}>View product</Link></article>)}</div><Link className="category-shop-link" href={shopHref}>View the full filtered collection</Link></section>;
      }

      if (section.type === "CATEGORY_GRID") {
        const categories = category.store.categories.slice(0, number(value.limit, 6));
        return <section className="category-benefits modular-category-grid" style={sectionStyle} key={section.id}><Heading eyebrow={common.eyebrow} headline={common.headline} copy={common.copy} /><div className="category-card-grid">{categories.map(item => <Link className="category-card" href={`/${item.slug}`} key={item.id}>{item.cardImageUrl ? <Image src={item.cardImageUrl} alt={item.cardImageAlt || item.name} width={520} height={340} unoptimized /> : <span className="icon"><CategoryIcon name={item.icon} /></span>}<h3>{item.cardTitle || item.name}</h3><p>{item.cardText || item.shortDescription}</p><strong>Explore</strong></Link>)}</div></section>;
      }

      if (section.type === "FAQ") {
        const items = ordered<FaqItem>(value.items);
        return <section className="faq-section category-faq" style={sectionStyle} key={section.id}><Heading eyebrow={common.eyebrow} headline={common.headline} copy={common.copy} /><div className="modular-faq-grid">{items.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>;
      }

      if (section.type === "CTA_BANNER") return <section className="category-final-cta modular-promo" style={sectionStyle} key={section.id}>{common.imageUrl && <Image src={common.imageUrl} alt={common.imageAlt} fill sizes="(max-width: 800px) 100vw, 1180px" unoptimized />}<div><Heading eyebrow={common.eyebrow} headline={common.headline} copy={common.copy} /><SectionActions value={value} fallbackHref={shopHref} /></div></section>;

      const bullets = array<string>(value.bullets);
      const layout = text(value.layout, "IMAGE_RIGHT").toLowerCase().replaceAll("_", "-");
      return <section className={`category-story ${layout}`} style={sectionStyle} key={section.id}><div><Heading eyebrow={common.eyebrow} headline={common.headline} copy={common.copy} />{bullets.length > 0 && <ul>{bullets.map(item => <li key={item}><Check size={18} />{item}</li>)}</ul>}<SectionActions value={value} fallbackHref={shopHref} /></div>{common.imageUrl && !layout.includes("text-only") && <Image src={common.imageUrl} alt={common.imageAlt} width={760} height={600} unoptimized />}</section>;
    })}
  </main>;
}

function SectionCopy({ eyebrow, headline, copy, fallbackHeadline, fallbackCopy, textBlocks }: { eyebrow: string; headline: string; copy: string; fallbackHeadline: string; fallbackCopy: string; textBlocks: TextBlock[] }) {
  if (!textBlocks.length) return <>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{headline || fallbackHeadline}</h1><p className="lead">{copy || fallbackCopy}</p></>;
  return <>{textBlocks.map((block, index) => {
    if (!block.text) return null;
    if (block.type === "EYEBROW") return <span className="eyebrow" key={index}>{block.text}</span>;
    if (block.type === "HEADING") return <h1 key={index}>{block.text}</h1>;
    if (block.type === "SUBHEADING") return <h2 key={index}>{block.text}</h2>;
    return block.type === "SUPPORTING_TEXT" ? <small className="hero-supporting" key={index}>{block.text}</small> : <p className="lead" key={index}>{block.text}</p>;
  })}</>;
}

function SectionActions({ value, fallbackHref }: { value: Record<string, unknown>; fallbackHref: string }) {
  const primary = text(value.ctaLabel); const secondary = text(value.secondaryCtaLabel);
  if ((!primary || value.ctaVisible === false) && (!secondary || value.secondaryCtaVisible === false)) return null;
  return <div className="actions">{primary && value.ctaVisible !== false && <Link className="button category-primary" style={buttonStyle(value, "cta")} href={text(value.ctaHref) || fallbackHref}>{primary}</Link>}{secondary && value.secondaryCtaVisible !== false && <Link className="button secondary" style={buttonStyle(value, "secondaryCta")} href={text(value.secondaryCtaHref) || fallbackHref}>{secondary}</Link>}</div>;
}

function Heading({ eyebrow, headline, copy }: { eyebrow: string; headline: string; copy: string }) { return <div className="section-head">{eyebrow && <span className="eyebrow">{eyebrow}</span>}{headline && <h2>{headline}</h2>}{copy && <p>{copy}</p>}</div>; }
function SectionImage({ url, alt, priority, placeholder }: { url: string; alt: string; priority?: boolean; placeholder: ReactNode }) { return url ? <Image src={url} alt={alt} width={900} height={720} priority={priority} unoptimized /> : placeholder; }
function CategoryPlaceholder({ category, storeName }: { category: PublicCategory; storeName: string }) { return <div className="category-hero-placeholder" role="img" aria-label={`${category.name} visual placeholder`}><div className="smart-object"><CategoryIcon name={category.icon} size={62} /><strong>{category.name}</strong><small>{storeName}</small></div></div>; }
function readCommon(value: Record<string, unknown>, fallbackHeadline: string) { return { eyebrow: text(value.eyebrow), headline: text(value.headline, fallbackHeadline), copy: text(value.copy), imageUrl: text(value.imageUrl), imageAlt: text(value.imageAlt) }; }
function surfaceStyle(value: Record<string, unknown>): CSSProperties { return { backgroundColor: colour(value.backgroundColour), color: colour(value.textColour), borderRadius: radius(value.radius) }; }
function buttonStyle(value: Record<string, unknown>, prefix: "cta" | "secondaryCta"): CSSProperties { return { backgroundColor: colour(value[`${prefix}Background`]), color: colour(value[`${prefix}TextColour`]), borderColor: colour(value[`${prefix}BorderColour`]) }; }
function colour(value: unknown) { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined; }
function radius(value: unknown) { return ({ SMALL: 12, MEDIUM: 20, LARGE: 32, EXTRA_LARGE: 48 } as Record<string, number>)[text(value)] ?? undefined; }
function ordered<T extends { visible?: boolean; order?: number }>(value: unknown) { return array<T>(value).filter(item => item.visible !== false).sort((left, right) => number(left.order) - number(right.order)); }
function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function number(value: unknown, fallback = 0) { return typeof value === "number" ? value : fallback; }
function array<T>(value: unknown) { return Array.isArray(value) ? value as T[] : []; }
