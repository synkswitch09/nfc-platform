"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Radio, Shapes, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { CartLink } from "@/components/cart-link";
import { LanguageSelector } from "@/components/language-selector";
import { localizedPath, type SystemCopy } from "@/lib/i18n";
import { isNavigationActive, type HeaderConfig } from "@/lib/site-chrome";
import { typographyStyle } from "@/lib/typography";

type CategoryLink = { name: string; slug: string };
type PageLink = { name: string; slug: string; order: number };
type OrderedNavItem = { id: string; order: number; content: ReactNode };

const headerFontFamilies = {
  INHERIT: undefined,
  INTER: "var(--font-inter), Inter, Arial, Helvetica, sans-serif",
  SANS: "Arial, Helvetica, sans-serif",
  SERIF: "Georgia, 'Times New Roman', serif",
  MONO: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;
const headerWeights = { THIN: 100, LIGHT: 300, REGULAR: 400, MEDIUM: 500, BOLD: 700, BLACK: 900 } as const;

export function SiteHeader({
  config,
  storeName,
  storeLogoUrl,
  categories,
  pages,
  commerce,
  nfcEnabled,
  authenticated,
  copy,
  locale,
  locales,
  defaultLocale,
}: {
  config: HeaderConfig;
  storeName: string;
  storeLogoUrl: string | null;
  categories: CategoryLink[];
  pages: PageLink[];
  commerce: boolean;
  nfcEnabled: boolean;
  authenticated: boolean;
  copy: SystemCopy;
  locale: string;
  locales: Array<{ code: string; name: string }>;
  defaultLocale: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const logoUrl = config.logoUrl || storeLogoUrl;
  const active = (path: string) => isNavigationActive(pathname, path);
  const close = () => setOpen(false);
  const BrandIcon = nfcEnabled ? Radio : Shapes;
  const href = (path: string) => localizedPath(path, locale, defaultLocale);
  const customLinks = config.customLinks.filter(
    (link) =>
      link.visible &&
      (link.audience === "ALL" ||
        (link.audience === "AUTHENTICATED") === authenticated),
  );
  const navItems: OrderedNavItem[] = [
    ...(config.showHome
      ? [
          {
            id: "home",
            order: config.homeOrder,
            content: (
              <Link
                className={active("/") ? "active" : ""}
                aria-current={active("/") ? "page" : undefined}
                href={href("/")}
                onClick={close}
                style={typographyStyle(config.homeTypography)}
              >
                {locale === defaultLocale ? config.homeLabel : copy.home}
              </Link>
            ),
          },
        ]
      : []),
    ...(config.showCategories
      ? categories.map((category, position) => {
          const path = `/${category.slug}`;
          return {
            id: `category:${category.slug}`,
            order: config.categoriesOrder + position / 100,
            content: (
              <Link
                className={
                  active(path)
                    ? "active category-nav-link"
                    : "category-nav-link"
                }
                aria-current={active(path) ? "page" : undefined}
                href={href(path)}
                onClick={close}
                style={typographyStyle(config.categoriesTypography)}
              >
                {category.name}
              </Link>
            ),
          };
        })
      : []),
    ...pages.map((page) => {
      const path = `/${page.slug}`;
      return {
        id: `page:${page.slug}`,
        order: page.order,
        content: (
          <Link
            className={active(path) ? "active" : ""}
            aria-current={active(path) ? "page" : undefined}
            href={href(path)}
            onClick={close}
            style={typographyStyle(config.customLinksTypography)}
          >
            {page.name}
          </Link>
        ),
      };
    }),
    ...customLinks.map((link) => ({
      id: link.id,
      order: link.order,
      content: (
        <Link
          className={active(link.href) ? "active" : ""}
          aria-current={active(link.href) ? "page" : undefined}
          href={href(link.href)}
          onClick={close}
          style={typographyStyle(config.customLinksTypography)}
        >
          {link.label}
        </Link>
      ),
    })),
    ...(config.showFaq
      ? [
          {
            id: "faq",
            order: config.faqOrder,
            content: (
              <Link
                className={active(config.faqHref) ? "active" : ""}
                aria-current={active(config.faqHref) ? "page" : undefined}
                href={href(config.faqHref)}
                onClick={close}
                style={typographyStyle(config.faqTypography)}
              >
                {locale === defaultLocale ? config.faqLabel : copy.faq}
              </Link>
            ),
          },
        ]
      : []),
    ...(commerce && config.showCart
      ? [
          {
            id: "cart",
            order: config.cartOrder,
            content: (
              <span onClick={close} style={typographyStyle(config.cartTypography)}>
                <CartLink
                  label={copy.cart}
                  itemsLabel={copy.items}
                  href={href("/cart")}
                />
              </span>
            ),
          },
        ]
      : []),
  ].sort((left, right) => left.order - right.order);
  const headerStyle = {
    "--header-background": config.backgroundColour || undefined,
    "--header-text": config.textColour || undefined,
    "--header-active": config.activeColour || undefined,
    "--header-shop-background": config.shopBackgroundColour || undefined,
    "--header-shop-text": config.shopTextColour || undefined,
    "--header-shop-border": config.shopBorderColour || undefined,
    "--header-account-background": config.accountBackgroundColour || undefined,
    "--header-account-text": config.accountTextColour || undefined,
    "--header-account-border": config.accountBorderColour || undefined,
  } as CSSProperties;

  return (
    <header className="site-header" style={headerStyle}>
      <Link
        href={href("/")}
        className="brand"
        aria-label={`${storeName} ${copy.home}`}
        onClick={close}
        style={{
          fontFamily: headerFontFamilies[config.fontFamily],
          fontSize: `calc(${config.textSizePx}px + 0.26rem)`,
          fontWeight: headerWeights[config.textWeight],
          fontStyle: config.textItalic ? "italic" : "normal",
          ...typographyStyle(config.brandTypography),
        }}
      >
        {logoUrl ? (
          <Image
            className="brand-logo"
            src={logoUrl}
            alt={storeName}
            width={168}
            height={48}
            priority
            unoptimized
          />
        ) : (
          <>
            <span className="brand-mark">
              <BrandIcon size={18} />
            </span>
            {storeName}
          </>
        )}
      </Link>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-label={open ? copy.closeNavigation : copy.openNavigation}
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav
        id="main-navigation"
        className={open ? "is-open" : ""}
        aria-label="Main navigation"
        style={{
          fontFamily: headerFontFamilies[config.fontFamily],
          fontSize: `${config.textSizePx}px`,
          fontWeight: headerWeights[config.textWeight],
          fontStyle: config.textItalic ? "italic" : "normal",
        }}
      >
        <div className="nav-centre">
          {navItems.map((item) => (
            <span className="nav-item" key={item.id}>
              {item.content}
            </span>
          ))}
        </div>
        <div className="nav-actions">
          {config.showLanguage && (
            <LanguageSelector
              locale={locale}
              locales={locales}
              defaultLocale={defaultLocale}
              label={copy.language}
            />
          )}
          {commerce && (
            <>
              <Link
                className="nav-shop"
                href={href(config.shopHref)}
                onClick={close}
                style={{
                  ...typographyStyle(config.shopTypography),
                  borderColor: config.shopBorderColour || undefined,
                }}
              >
                {locale === defaultLocale ? config.shopLabel : copy.shop}
              </Link>
              <Link
                className="nav-account"
                href={href(
                  authenticated ? config.accountHref : config.signInHref,
                )}
                onClick={close}
                style={typographyStyle(
                  authenticated
                    ? config.accountTypography
                    : config.signInTypography,
                )}
              >
                {authenticated
                  ? locale === defaultLocale
                    ? config.accountLabel
                    : copy.myProducts
                  : locale === defaultLocale
                    ? config.signInLabel
                    : copy.signIn}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
