import { notFound } from "next/navigation";
import { getCurrentStorefront } from "@/lib/storefront";
import { parseAccountConfig } from "@/lib/account-config";
import { FavouritesProducts } from "@/components/favourites-products";
export const metadata = { title: "Favourites", robots: { index: false, follow: false } };
export default async function FavouritesPage() {
  const store = await getCurrentStorefront();
  if (!parseAccountConfig(store.accountConfig).favouritesEnabled) notFound();
  return <section className="section favourites-page"><h1>Your favourites</h1><p>Your saved pieces, all in one place.</p><FavouritesProducts currency={store.currency} kosykin={store.slug === "kosykin"} /></section>;
}
