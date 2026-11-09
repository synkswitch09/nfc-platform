import type { PromotionAction } from "@/lib/promotion-action";
import { KosykinProductCard, type StorefrontCardProduct } from "@/components/kosykin-product-card";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { KosykinPromotions } from "@/components/kosykin-promotions";
import { CustomerReviewCard } from "@/components/customer-review-card";
import { StorefrontIcon } from '@/components/storefront-icon';
import type { StorefrontIconSlot } from '@/lib/storefront-icons';
import type { FooterConfig } from "@/lib/site-chrome";
import type { LandingSectionType } from "@prisma/client";

type Product = StorefrontCardProduct & { featured: boolean };
type Item = PromotionAction & { id: string; title?: string; description?: string; productName?: string; rating?: number; supportingText?: string; imageUrl?: string; imageAlt?: string; icon?: string; iconUrl?: string; ctaLabel?: string; ctaHref?: string; visible?: boolean; order?: number };
const whyIcons: Record<string, StorefrontIconSlot> = { sparkles: 'whyAppearance', package: 'whyProduction', 'hand-helping': 'whyMaterials', 'heart-handshake': 'whyDetail' };
const text = (value: unknown) => typeof value === "string" ? value : "";
const items = (value: unknown) => (Array.isArray(value) ? value as Item[] : []).filter(item => item.visible !== false).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
export function KosykinHomeSection({ type, value, products, currency, socials }: { socials?: { links: Record<string, string>; icons: FooterConfig["socialIcons"] }; type: LandingSectionType; value: Record<string, unknown>; products: Product[]; currency: string }) {
  const heading = <div className="kosy-section-heading"><h2>{text(value.headline)}</h2>{value.copy ? <p>{text(value.copy)}</p> : null}</div>;
  const supportActionStyle = value.layoutVariant === "KOSYKIN_SUPPORT" ? {
    backgroundColor: text(value.ctaBackground) || undefined,
    color: text(value.ctaTextColour) || undefined,
    borderColor: text(value.ctaBorderColour) || undefined,
  } : undefined;
  const action = value.ctaVisible !== false && text(value.ctaLabel) && text(value.ctaHref) ? <Link className="kosy-section-action" style={supportActionStyle} href={text(value.ctaHref)}>{text(value.ctaLabel)}<StorefrontIcon name="arrowRight" size={17} fallback={<ArrowRight size={17} aria-hidden="true" />} /></Link> : null;
  if (type === "PRODUCT_SHOWCASE" || type === "PRODUCT_GRID") {
    const visible = products.filter(product => (!value.featuredOnly || product.featured) && product.variants.length > 0).slice(0, Number(value.limit) || 4);
    return <>{heading}<div className="kosy-featured-grid">{visible.map(product => <KosykinProductCard key={product.id} product={product} currency={currency} />)}</div>{!visible.length && <p className="kosy-empty-products">Our collection is taking shape. <Link href="/shop">Explore the shop</Link>.</p>}</>;
  }
  if (type === "FEATURE_LIST") return <>{heading}<div className="kosy-why-content">{text(value.imageUrl) && <Image className="kosy-why-image" src={text(value.imageUrl)} alt={text(value.imageAlt)} width={700} height={700} unoptimized />}<div className="kosy-why-grid">{items(value.items).map(item => <article key={item.id}><span><StorefrontIcon name={whyIcons[item.icon || '']} imageUrl={item.iconUrl} size={58} fallback={<CategoryIcon name={item.icon} size={30} />} /></span><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div></div>{action}</>;
  if (type === "MEDIA_CONTENT") return <div className="kosy-story-panel">{text(value.imageUrl) && <Image src={text(value.imageUrl)} alt={text(value.imageAlt)} fill sizes="(max-width: 800px) 100vw, 1340px" unoptimized />}<div>{heading}{action}</div></div>;
  if (type === "FAQ") return <><div>{heading}{action}</div><div className="kosy-faq-list">{(Array.isArray(value.items) ? value.items as { id: string; question: string; answer: string; visible?: boolean; order?: number }[] : []).filter(item => item.visible !== false).sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map(item => <details key={item.id}><summary>{item.question}<span className="kosy-faq-toggle" aria-hidden="true"><StorefrontIcon name="faq" size={18} fallback={<>+</>} /></span></summary><p>{item.answer}</p></details>)}</div></>;
  if (value.layoutVariant === "KOSYKIN_PROMOTIONS") {
    const slides = items(value.items);
    return <KosykinPromotions slides={slides.length ? slides.map(item => ({ ...item, title: item.title || "", description: item.description || "" })) : [{ id: "main", title: text(value.headline), description: text(value.copy), ctaLabel: text(value.ctaLabel), ctaHref: text(value.ctaHref), imageUrl: text(value.imageUrl), imageAlt: text(value.imageAlt), ctaVisible: value.ctaVisible !== false, ctaBackground: text(value.ctaBackground), ctaTextColour: text(value.ctaTextColour), ctaBorderColour: text(value.ctaBorderColour), ctaPositionX: typeof value.ctaPositionX === "number" ? value.ctaPositionX : undefined, ctaPositionY: typeof value.ctaPositionY === "number" ? value.ctaPositionY : undefined }]} />;
  }
  if (value.layoutVariant === "KOSYKIN_REVIEWS") {
    const reviews = items(value.items);
    if (!reviews.length) return null;
    return <>{heading}<div className="kosy-review-grid">{reviews.map(item => <CustomerReviewCard key={item.id} productName={item.productName || item.ctaLabel} productHref={item.ctaHref} rating={item.rating} body={item.description} author={item.title} supportingText={item.supportingText} />)}</div></>;
  }
  if (value.layoutVariant === "KOSYKIN_SUPPORT") return <><div className="kosy-support-brand"><Image src={text(value.imageUrl) || "/images/kosykin/wordmark-navy.webp"} alt="Kosy Kin" width={150} height={50} unoptimized />{socials && <div className="kosy-support-socials">{(["instagram", "facebook"] as const).filter(platform => socials.links[platform]).map(platform => <a href={socials.links[platform]} key={platform} target="_blank" rel="noopener noreferrer" aria-label={platform}><StorefrontIcon name={platform} imageUrl={socials.icons[platform]} size={22} fallback={platform === "instagram" ? <Camera size={20} aria-hidden="true" /> : <b aria-hidden="true">f</b>} /></a>)}</div>}</div><div>{heading}</div><div>{action}</div></>;
  return <>{heading}{action}</>;
}
