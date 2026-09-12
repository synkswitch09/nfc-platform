"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Radio, Shapes, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CartLink } from "@/components/cart-link";
import { isNavigationActive, type HeaderConfig } from "@/lib/site-chrome";

type CategoryLink = { name: string; slug: string };

export function SiteHeader({ config, storeName, storeLogoUrl, categories, commerce, nfcEnabled, authenticated }: { config: HeaderConfig; storeName: string; storeLogoUrl: string | null; categories: CategoryLink[]; commerce: boolean; nfcEnabled: boolean; authenticated: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const logoUrl = config.logoUrl || storeLogoUrl;
  const active = (href: string) => isNavigationActive(pathname, href);
  const close = () => setOpen(false);
  const BrandIcon = nfcEnabled ? Radio : Shapes;
  return <header className="site-header">
    <Link href="/" className="brand" aria-label={`${storeName} home`} onClick={close}>{logoUrl ? <Image className="brand-logo" src={logoUrl} alt={storeName} width={168} height={48} priority unoptimized /> : <><span className="brand-mark"><BrandIcon size={18} /></span>{storeName}</>}</Link>
    <button className="mobile-nav-toggle" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(value => !value)}>{open ? <X /> : <Menu />}</button>
    <nav id="main-navigation" className={open ? "is-open" : ""} aria-label="Main navigation">
      <div className="nav-centre">
        {config.showHome && <Link className={active("/") ? "active" : ""} aria-current={active("/") ? "page" : undefined} href="/" onClick={close}>{config.homeLabel}</Link>}
        {categories.map(category => { const href = `/${category.slug}`; return <Link className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined} href={href} key={category.slug} onClick={close}>{category.name}</Link>; })}
        {config.showFaq && <Link className={pathname === config.faqHref ? "active" : ""} href={config.faqHref} onClick={close}>{config.faqLabel}</Link>}
        {commerce && config.showCart && <CartLink />}
      </div>
      {commerce && <div className="nav-actions"><Link className="nav-shop" href="/shop" onClick={close}>{config.shopLabel}</Link><Link className="nav-account" href={authenticated ? "/dashboard" : "/login"} onClick={close}>{authenticated ? config.accountLabel : config.signInLabel}</Link></div>}
    </nav>
  </header>;
}
