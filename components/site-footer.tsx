import Image from "next/image";
import { StorefrontIcon } from "@/components/storefront-icon";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Camera,
  Music2,
  MessageCircle,
  Radio,
  Shapes,
  Globe,
  Users,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { footerSocialProfiles, type FooterConfig } from "@/lib/site-chrome";
import { localizedPath, type SystemCopy } from "@/lib/i18n";
import { typographyStyle } from "@/lib/typography";

const socialIcons = {
  instagram: Camera,
  tumblr: MessageCircle,
  facebook: Users,
  linkedin: BriefcaseBusiness,
  tiktok: Music2,
} as const;

type PageLink = { name: string; slug: string; order: number };

export function SiteFooter({
  config,
  storeName,
  storeLogoUrl,
  socialLinks,
  pages,
  nfcEnabled,
  copy,
  locale,
  defaultLocale,
  kosykinLayout = false,
  support,
}: {
  kosykinLayout?: boolean;
  support?: ReactNode;
  config: FooterConfig;
  storeName: string;
  storeLogoUrl: string | null;
  socialLinks: Record<string, string>;
  pages: PageLink[];
  nfcEnabled: boolean;
  copy: SystemCopy;
  locale: string;
  defaultLocale: string;
}) {
  const logoUrl = config.logoUrl || storeLogoUrl;
  const BrandIcon = nfcEnabled ? Radio : Shapes;
  const customLinks = config.customLinks
    .filter((link) => link.visible)
    .sort((a, b) => a.order - b.order);
  const managedLinks = (config.includeManagedPages ? pages : [])
    .filter(
      (page) =>
        !(page.slug === "terms" && config.showTerms) &&
        !(page.slug === "privacy" && config.showPrivacy),
    )
    .map((page) => ({
      id: `page:${page.slug}`,
      label: page.name,
      href: `/${page.slug}`,
      visible: true,
      order: page.order,
    }));
  const links = [...managedLinks, ...customLinks]
    .filter(
      (link, index, rows) =>
        rows.findIndex((item) => item.href === link.href) === index,
    )
    .sort((a, b) => a.order - b.order);
  const copyright =
    config.copyright ||
    `© ${new Date().getUTCFullYear()} ${storeName}. All rights reserved.`;
  const footerStyle = {
    "--footer-background": config.backgroundColour || undefined,
    "--footer-text": config.textColour || undefined,
    "--footer-link": config.linkColour || undefined,
    "--footer-border": config.borderColour || undefined,
    fontFamily:
      config.fontFamily === "INTER"
        ? "var(--font-inter), Inter, Arial, Helvetica, sans-serif"
        : config.fontFamily === "SANS"
          ? "Arial, Helvetica, sans-serif"
          : config.fontFamily === "SERIF"
            ? "Georgia, 'Times New Roman', serif"
            : config.fontFamily === "MONO"
              ? "ui-monospace, monospace"
              : undefined,
    fontWeight: (
      {
        THIN: 100,
        LIGHT: 300,
        REGULAR: 400,
        MEDIUM: 500,
        BOLD: 700,
        BLACK: 900,
      } as const
    )[config.textWeight],
    fontStyle: config.textItalic ? "italic" : "normal",
    fontSize: `${config.textSizePx}px`,
  } as CSSProperties;
  if (kosykinLayout) {
    const legalRows = [
      ...(config.showPrivacy
        ? [
            {
              id: "privacy",
              label:
                locale === defaultLocale ? config.privacyLabel : copy.privacy,
              href: "/privacy",
              typography: config.privacyTypography,
            },
          ]
        : []),
      {
        id: "support",
        label:
          links.find((link) => link.href === "/support")?.label ||
          "Help & Requests",
        href: "/support",
        typography: config.customLinksTypography,
      },
      ...(config.showTerms
        ? [
            {
              id: "terms",
              label: locale === defaultLocale ? config.termsLabel : copy.terms,
              href: "/terms",
              typography: config.termsTypography,
            },
          ]
        : []),
      ...links
        .filter(
          (link) =>
            ![
              "/support",
              ...(config.showPrivacy ? ["/privacy"] : []),
              ...(config.showTerms ? ["/terms"] : []),
            ].includes(link.href),
        )
        .map((link) => ({ ...link, typography: config.customLinksTypography })),
    ];
    return (
      <footer className="site-footer kosy-footer" style={footerStyle}>
        {support}
        <div className="kosy-footer-legal">
          <p
            className="footer-copyright"
            style={typographyStyle(config.copyrightTypography)}
          >
            {copyright}
          </p>
          <nav className="footer-links" aria-label="Footer">
            {legalRows.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.id}
                  href={localizedPath(link.href, locale, defaultLocale)}
                  style={typographyStyle(link.typography)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={typographyStyle(link.typography)}
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>
        </div>
      </footer>
    );
  }
  return (
    <footer className="site-footer" style={footerStyle}>
      <div className="footer-brand">
        <Link
          href={localizedPath("/", locale, defaultLocale)}
          aria-label={`${storeName} ${copy.home}`}
        >
          {logoUrl ? (
            <Image
              className={
                config.logoTreatment === "CREAM"
                  ? "brand-logo cream-logo"
                  : "brand-logo"
              }
              src={logoUrl}
              alt={storeName}
              width={168}
              height={48}
              unoptimized
            />
          ) : (
            <span className="brand">
              <span className="brand-mark">
                <BrandIcon size={18} />
              </span>
              {storeName}
            </span>
          )}
        </Link>
        {config.tagline && (
          <p style={typographyStyle(config.taglineTypography)}>
            {config.tagline}
          </p>
        )}
      </div>
      <p
        className="footer-copyright"
        style={typographyStyle(config.copyrightTypography)}
      >
        {copyright}
      </p>
      <div className="footer-end">
        <FooterSocialLinks config={config} socialLinks={socialLinks} />
        <div className="footer-links">
          {!links.some((link) => link.href === "/support") && (
            <Link
              href="/support"
              style={typographyStyle(config.customLinksTypography)}
            >
              Help & requests
            </Link>
          )}
          {links.map((link) =>
            link.href.startsWith("/") ? (
              <Link
                href={localizedPath(link.href, locale, defaultLocale)}
                key={link.id}
                style={typographyStyle(config.customLinksTypography)}
              >
                {link.label}
              </Link>
            ) : (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                key={link.id}
                style={typographyStyle(config.customLinksTypography)}
              >
                {link.label}
              </a>
            ),
          )}
          {config.showTerms && (
            <Link
              href={localizedPath("/terms", locale, defaultLocale)}
              style={typographyStyle(config.termsTypography)}
            >
              {locale === defaultLocale ? config.termsLabel : copy.terms}
            </Link>
          )}
          {config.showPrivacy && (
            <Link
              href={localizedPath("/privacy", locale, defaultLocale)}
              style={typographyStyle(config.privacyTypography)}
            >
              {locale === defaultLocale ? config.privacyLabel : copy.privacy}
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}

export function FooterSocialLinks({
  config,
  socialLinks,
  dark = false,
}: {
  config: FooterConfig;
  socialLinks: Record<string, string>;
  dark?: boolean;
}) {
  const socials = footerSocialProfiles(config, socialLinks)
    .filter((row) => row.visible)
    .sort((a, b) => a.order - b.order);
  return socials.length > 0 ? (
    <div className="footer-socials">
      {socials.map((profile) => {
        const Icon =
          socialIcons[
            profile.label.toLowerCase() as keyof typeof socialIcons
          ] ?? Globe;
        const imageUrl = profile.iconUrl;
        const icon = imageUrl ? (
          <Image
            className="footer-social-icon-image"
            src={imageUrl}
            alt=""
            width={20}
            height={20}
            unoptimized
          />
        ) : (
          <StorefrontIcon
            name={
              profile.label.toLowerCase() === "instagram"
                ? dark
                  ? "instagram"
                  : "instagramFooter"
                : profile.label.toLowerCase() === "facebook"
                  ? dark
                    ? "facebook"
                    : "facebookFooter"
                  : undefined
            }
            size={20}
            fallback={<Icon size={19} />}
          />
        );
        const href = profile.href;
        return href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={profile.label}
            key={profile.id}
          >
            {icon}
          </a>
        ) : (
          <span
            className="footer-social-preview"
            aria-hidden="true"
            key={profile.id}
          >
            {icon}
          </span>
        );
      })}
    </div>
  ) : null;
}
