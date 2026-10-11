import Link from "next/link";
import type { Storefront } from "@/lib/storefront";
import { validAbn } from "@/lib/business-identity";

export function LegalPageIntro({ name, store }: { name: string; store: Storefront }) {
  const abn = typeof store.organization.abn === "string" ? store.organization.abn : "";
  const registeredName = typeof store.organization.registeredBusinessName === "string" ? store.organization.registeredBusinessName : "";
  return <header className="section compact-section legal-page-intro">
    <h1>{name}</h1>
    {store.legalName && <p>Seller: {store.legalName}{registeredName && `, trading as ${registeredName}`}{validAbn(abn) && ` · ABN ${abn}`}</p>}
    {store.organization.gstRegistered === false && <p>Not currently registered for GST.</p>}
    {store.slug === "kosykin" && <nav aria-label="Policies and help">
      <Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link>
      <Link href="/shipping-delivery">Shipping & delivery</Link><Link href="/returns-cancellations">Returns & cancellations</Link>
      <Link href="/custom-designs">Custom designs</Link><Link href="/customer-points">Customer points</Link>
      <Link href="/faq">FAQs</Link><Link href="/support">Help & requests</Link>
    </nav>}
  </header>;
}
