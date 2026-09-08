import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Radio } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { CartLink } from "@/components/cart-link";
import { CartProvider } from "@/components/cart-provider";
import { getStoreSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return { metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"), title: { default: settings.siteTitle, template: `%s · ${settings.storeName}` }, description: settings.siteDescription, openGraph: { title: settings.siteTitle, description: settings.siteDescription, type: "website", locale: "en_AU", images: settings.defaultSocialImageUrl ? [settings.defaultSocialImageUrl] : [] } };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, settings] = await Promise.all([getCurrentUser(), getStoreSettings()]);
  return (
    <html lang="en-AU">
      <body>
        <CartProvider>
        <header className="site-header">
          <Link href="/" className="brand"><span className="brand-mark"><Radio size={18} /></span>{settings.storeName}</Link>
          <nav aria-label="Main navigation">
            <Link href="/shop">Shop</Link>
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
