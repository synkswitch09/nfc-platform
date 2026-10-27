import { CategoryIcon } from "@/components/category-icon";
import { StorefrontIcon } from "@/components/storefront-icon";

/** Home, shop and detail pages read the same CMS feature content. */
export function KosykinTrustRow({ content }: { content?: Record<string, unknown> }) {
  const features = (Array.isArray(content?.features) ? content.features as { id?: string; label?: string; supportingText?: string; icon?: string; iconUrl?: string; visible?: boolean }[] : []).filter(item => item.visible !== false && item.label?.trim());
  if (!features.length) return null;
  return <div className="kosy-trust-row kosy-shop-trust">{features.map((feature, index) => <div key={feature.id || index}><span className="kosy-trust-icon"><StorefrontIcon name={feature.icon === "shield-check" ? "secureCheckout" : feature.icon === "package" ? "shipping" : "madeToOrder"} imageUrl={feature.iconUrl} size={28} fallback={<CategoryIcon name={feature.icon} size={28} />} /></span><span><strong>{feature.label}</strong>{feature.supportingText && <small>{feature.supportingText}</small>}</span></div>)}</div>;
}
