"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Radio, Shapes, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CartLink } from "@/components/cart-link";
import { isNavigationActive, type HeaderConfig } from "@/lib/site-chrome";
import { LanguageSelector } from "@/components/language-selector";
import { localizedPath, type SystemCopy } from "@/lib/i18n";

type CategoryLink = { name: string; slug: string };

export function SiteHeader({ config, storeName, storeLogoUrl, categories, commerce, nfcEnabled, authenticated, copy, locale, locales, defaultLocale }: { config: HeaderConfig; storeName: string; storeLogoUrl: string | null; categories: CategoryLink[]; commerce: boolean; nfcEnabled: boolean; authenticated: boolean; copy: SystemCopy; locale: string; locales: Array<{ code: string; name: string }>; defaultLocale: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const logoUrl = config.logoUrl || storeLogoUrl;
  const active = (href: string) => isNavigationActive(pathname, href);
  const close = () => setOpen(false);
  const BrandIcon = nfcEnabled ? Radio : Shapes;
  const href = (path: string) => localizedPath(path, locale, defaultLocale);
  return <header className="site-header">
    <Link href={href("/")} className="brand" aria-label={`${storeName} ${copy.home}`} onClick={close}>{logoUrl ? <Image className="brand-logo" src={logoUrl} alt={storeName} width={168} height={48} priority unoptimized /> : <><span className="brand-mark"><BrandIcon size={18} /></span>{storeName}</>}</Link>
    <button className="mobile-nav-toggle" type="button" aria-label={open ? copy.closeNavigation : copy.openNavigation} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(value => !value)}>{open ? <X /> : <Menu />}</button>
    <nav id="main-navigation" className={open ? "is-open" : ""} aria-label="Main navigation">
      <div className="nav-centre">
        {config.showHome && <Link className={active("/") ? "active" : ""} aria-current={active("/") ? "page" : undefined} href={href("/")} onClick={close}>{locale === defaultLocale ? config.homeLabel : copy.home}</Link>}
        {categories.map(category => { const path = `/${category.slug}`; return <Link className={active(path) ? "active" : ""} aria-current={active(path) ? "page" : undefined} href={href(path)} key={category.slug} onClick={close}>{category.name}</Link>; })}
        {config.showFaq && <Link className={pathname === config.faqHref ? "active" : ""} href={href(config.faqHref)} onClick={close}>{locale === defaultLocale ? config.faqLabel : copy.faq}</Link>}
        {commerce && config.showCart && <CartLink label={copy.cart} itemsLabel={copy.items} href={href("/cart")} />}
      </div>
      <div className="nav-actions"><LanguageSelector locale={locale} locales={locales} defaultLocale={defaultLocale} label={copy.language} />{commerce && <><Link className="nav-shop" href={href("/shop")} onClick={close}>{locale === defaultLocale ? config.shopLabel : copy.shop}</Link><Link className="nav-account" href={href(authenticated ? "/dashboard" : "/login")} onClick={close}>{authenticated ? (locale === defaultLocale ? config.accountLabel : copy.myProducts) : (locale === defaultLocale ? config.signInLabel : copy.signIn)}</Link></>}</div>
    </nav>
  </header>;
}
