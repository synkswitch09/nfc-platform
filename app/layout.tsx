import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Radio } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { CartLink } from "@/components/cart-link";
import { CartProvider } from "@/components/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TapKind NFC", template: "%s · TapKind NFC" },
  description: "Smart NFC tags for pets, families, social profiles and business in Australia.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en-AU">
      <body>
        <CartProvider>
        <header className="site-header">
          <Link href="/" className="brand"><span className="brand-mark"><Radio size={18} /></span>TapKind</Link>
          <nav aria-label="Main navigation">
            <Link href="/shop">Shop</Link>
            <Link href="/#how-it-works">How it works</Link>
            <CartLink />
            {user ? <Link className="nav-cta" href="/dashboard">My products</Link> : <Link className="nav-cta" href="/login">Sign in</Link>}
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <div><span className="brand"><ShieldCheck size={18} />TapKind</span><p>Privacy-first NFC products, designed in Australia.</p></div>
          <div className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="mailto:hello@example.com">Contact</a></div>
        </footer>
        </CartProvider>
      </body>
    </html>
  );
}
