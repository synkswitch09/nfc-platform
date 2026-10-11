import type { Storefront } from "@/lib/storefront";
import { validAbn } from "@/lib/business-identity";

export function LegalSellerInformation({ store }: { store: Storefront }) {
  const name = typeof store.organization.registeredBusinessName === "string" ? store.organization.registeredBusinessName : "";
  const abn = typeof store.organization.abn === "string" ? store.organization.abn : "";
  if (!name && !validAbn(abn)) return null;
  const formattedAbn = validAbn(abn) ? `${abn.slice(0, 2)} ${abn.slice(2, 5)} ${abn.slice(5, 8)} ${abn.slice(8)}` : "";
  return <section className="section compact-section legal-seller-information">
    {store.organization.gstRegistered === false && <><h2>Prices and GST</h2><p>We are not currently registered for GST and do not charge GST on our sales.</p></>}
    <h2>Seller information</h2><p>{name}{formattedAbn && `${name ? " · " : ""}ABN ${formattedAbn}`}</p>
  </section>;
}
