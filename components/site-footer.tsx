import Image from "next/image";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Camera,
  Music2,
  Radio,
  Shapes,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { FooterConfig } from "@/lib/site-chrome";
import { localizedPath, type SystemCopy } from "@/lib/i18n";
import { typographyStyle } from "@/lib/typography";

const socialIcons = {
  instagram: Camera,
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
}: {
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
  const managedLinks = pages
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
  const socials = Object.entries(socialLinks).filter(
    (entry): entry is [keyof typeof socialIcons, string] =>
      Boolean(entry[1]) && entry[0] in socialIcons,
  );
  const copyright =
    config.copyright ||
    `© ${new Date().getUTCFullYear()} ${storeName}. All rights reserved.`;
  const footerStyle = {
    "--footer-background": config.backgroundColour || undefined,
    "--footer-text": config.textColour || undefined,
    "--footer-link": config.linkColour || undefined,
    "--footer-border": config.borderColour || undefined,
    fontFamily: config.fontFamily === "INTER" ? "var(--font-inter), Inter, Arial, Helvetica, sans-serif" : config.fontFamily === "SANS" ? "Arial, Helvetica, sans-serif" : config.fontFamily === "SERIF" ? "Georgia, 'Times New Roman', serif" : config.fontFamily === "MONO" ? "ui-monospace, monospace" : undefined,
    fontWeight: ({ THIN: 100, LIGHT: 300, REGULAR: 400, MEDIUM: 500, BOLD: 700, BLACK: 900 } as const)[config.textWeight],
    fontStyle: config.textItalic ? "italic" : "normal",
    fontSize: `${config.textSizePx}px`,
  } as CSSProperties;
  return (
    <footer className="site-footer" style={footerStyle}>
      <div className="footer-brand">
        {logoUrl ? (
          <Image
            className="brand-logo"
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
        {socials.length > 0 && (
          <div className="footer-socials">
            {socials.map(([platform, href]) => {
              const Icon = socialIcons[platform];
              const imageUrl = config.socialIcons[platform];
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={platform}
                  key={platform}
                >
                  {imageUrl ? (
                    <Image
                      className="footer-social-icon-image"
                      src={imageUrl}
                      alt=""
                      width={20}
                      height={20}
                      unoptimized
                    />
                  ) : (
                    <Icon size={19} />
                  )}
                </a>
              );
            })}
          </div>
        )}
        <div className="footer-links">
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
