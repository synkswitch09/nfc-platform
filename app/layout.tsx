import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Radio } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { CartLink } from "@/components/cart-link";
import { CartProvider } from "@/components/cart-provider";
import { getStoreSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  const config = getRuntimeConfig();
  return { metadataBase: new URL(config.appUrl), robots: searchEnginePolicy(config.appEnv), title: { default: settings.siteTitle, template: `%s · ${settings.storeName}` }, description: settings.siteDescription, applicationName: "Tapkin", openGraph: { siteName: "Tapkin", title: settings.siteTitle, description: settings.siteDescription, type: "website", locale: "en_AU", images: settings.defaultSocialImageUrl ? [settings.defaultSocialImageUrl] : [] }, twitter: { card: settings.defaultSocialImageUrl ? "summary_large_image" : "summary", title: settings.siteTitle, description: settings.siteDescription, images: settings.defaultSocialImageUrl ? [settings.defaultSocialImageUrl] : [] } };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, settings, categories] = await Promise.all([getCurrentUser(), getStoreSettings(), process.env.DATABASE_URL ? db.productCategory.findMany({ where: { status: "PUBLISHED", showInNavigation: true }, select: { name: true, slug: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 6 }).catch(() => []) : []]);
  return (
    <html lang="en-AU">
      <body>
        <CartProvider>
        <header className="site-header">
          <Link href="/" className="brand"><span className="brand-mark"><Radio size={18} /></span>{settings.storeName}</Link>
          <nav aria-label="Main navigation">
            <Link href="/shop">Shop</Link>
            {categories.map(category => <Link className="category-nav-link" href={`/${category.slug}`} key={category.slug}>{category.name}</Link>)}
            <Link href="/#how-it-works">How it works</Link>
            <CartLink />
            {user ? <Link className="nav-cta" href="/dashboard">My products</Link> : <Link className="nav-cta" href="/login">Sign in</Link>}
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <div><span className="brand"><ShieldCheck size={18} />{settings.storeName}</span><p>Privacy-first NFC products, designed in Australia.</p></div>
          <div className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={`mailto:${settings.supportEmail}`}>Contact</a></div>
        </footer>
        </CartProvider>
      </body>
    </html>
  );
}
