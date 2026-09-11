import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Radio, Shapes } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { CartLink } from "@/components/cart-link";
import { CartProvider } from "@/components/cart-provider";
import { getStoreSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront, hasStoreCapability, isStoreCommerceAvailable, storeThemeStyle } from "@/lib/storefront";
import { StoreCapability, StoreStatus } from "@prisma/client";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getCurrentStorefront();
  const settings = await getStoreSettings(store);
  const config = getRuntimeConfig();
  return { metadataBase: new URL(store.origin), robots: store.status === StoreStatus.ACTIVE ? searchEnginePolicy(config.appEnv) : { index: false, follow: false }, title: { default: settings.siteTitle, template: `%s · ${settings.storeName}` }, description: settings.siteDescription, applicationName: settings.storeName, icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined, openGraph: { siteName: settings.storeName, title: settings.siteTitle, description: settings.siteDescription, type: "website", locale: "en_AU", url: store.origin, images: settings.defaultSocialImageUrl ? [settings.defaultSocialImageUrl] : [] }, twitter: { card: settings.defaultSocialImageUrl ? "summary_large_image" : "summary", title: settings.siteTitle, description: settings.siteDescription, images: settings.defaultSocialImageUrl ? [settings.defaultSocialImageUrl] : [] } };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = await getCurrentStorefront();
  const [user, settings, categories] = await Promise.all([getCurrentUser(), getStoreSettings(store), process.env.DATABASE_URL && store.status === StoreStatus.ACTIVE ? db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showInNavigation: true }, select: { name: true, slug: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 6 }).catch(() => []) : []]);
  const commerce = isStoreCommerceAvailable(store);
  const BrandIcon = hasStoreCapability(store, StoreCapability.NFC) ? Radio : Shapes;
  return (
    <html lang="en-AU">
      <body data-store={store.slug} data-theme-style={store.theme.fontStyle} style={storeThemeStyle(store.theme)}>
        <CartProvider storageKey={`commerce-cart:${store.id}:v1`}>
        <header className="site-header">
          <Link href="/" className="brand" aria-label={`${settings.storeName} home`}>{store.logoUrl ? <Image className="brand-logo" src={store.logoUrl} alt="" width={168} height={48} unoptimized /> : <><span className="brand-mark"><BrandIcon size={18} /></span>{settings.storeName}</>}</Link>
          <nav aria-label="Main navigation">
            {commerce && <Link href="/shop">Shop</Link>}
            {categories.map(category => <Link className="category-nav-link" href={`/${category.slug}`} key={category.slug}>{category.name}</Link>)}
            {commerce && <Link href="/#how-it-works">How it works</Link>}
            {commerce && <CartLink />}
            {user ? <Link className="nav-cta" href="/dashboard">My products</Link> : <Link className="nav-cta" href="/login">Sign in</Link>}
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <div><span className="brand"><ShieldCheck size={18} />{settings.storeName}</span><p>Thoughtful products, designed and made in Australia.</p></div>
          <div className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={`mailto:${settings.supportEmail}`}>Contact</a></div>
        </footer>
        </CartProvider>
      </body>
    </html>
  );
}
