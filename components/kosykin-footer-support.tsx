import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { FooterConfig } from "@/lib/site-chrome";
import { localizedPath } from "@/lib/i18n";
import { typographyStyle } from "@/lib/typography";
import { FooterSocialLinks } from "@/components/site-footer";
import { StorefrontIcon } from "@/components/storefront-icon";

export function KosykinFooterSupport({
  config,
  socialLinks,
  storeName,
  locale,
  defaultLocale,
}: {
  config: FooterConfig;
  socialLinks: Record<string, string>;
  storeName: string;
  locale: string;
  defaultLocale: string;
}) {
  const support = config.support;
  if (!support.enabled) return null;
  const customLogo =
    config.logoUrl &&
    ![
      "/images/kosykin/logo.png",
      "/images/kosykin/wordmark-navy.webp",
    ].includes(config.logoUrl)
      ? config.logoUrl
      : "";
  return (
    <section
      className="kosy-footer-support"
      aria-label={support.headline}
      style={{
        backgroundColor: support.backgroundColour || undefined,
        color: support.textColour || undefined,
      }}
    >
      <div className="kosy-footer-identity">
        <Link
          className="kosy-footer-brand"
          href={localizedPath("/", locale, defaultLocale)}
          aria-label={`${storeName} Home`}
        >
          {customLogo ? (
            <Image
              src={customLogo}
              alt={storeName}
              width={112}
              height={66}
              unoptimized
            />
          ) : (
            <span
              className="kosy-footer-stacked-logo"
              role="img"
              aria-label={storeName}
            >
              <span>
                <Image
                  src="/images/kosykin/wordmark-navy.webp"
                  alt=""
                  width={708}
                  height={101}
                  unoptimized
                />
              </span>
              <span>
                <Image
                  src="/images/kosykin/wordmark-navy.webp"
                  alt=""
                  width={708}
                  height={101}
                  unoptimized
                />
              </span>
            </span>
          )}
        </Link>
        <FooterSocialLinks config={config} socialLinks={socialLinks} dark />
      </div>
      <div className="kosy-footer-help">
        <h2 style={typographyStyle(support.headlineTypography)}>
          {support.headline}
        </h2>
        <p style={typographyStyle(support.copyTypography)}>{support.copy}</p>
        {support.responseText && (
          <p
            className="kosy-footer-response"
            style={typographyStyle(support.copyTypography)}
          >
            <StorefrontIcon
              name="clock"
              size={22}
              fallback={<Clock3 size={22} />}
            />
            <span>{support.responseText}</span>
          </p>
        )}
      </div>
      <div
        className="kosy-footer-actions"
        style={typographyStyle(support.buttonTypography)}
      >
        <Link
          className="kosy-footer-contact"
          href={localizedPath("/support", locale, defaultLocale)}
        >
          {support.contactLabel}
        </Link>
        {support.instagramVisible &&
          (support.instagramHref ? (
            <a
              className="kosy-footer-instagram"
              href={support.instagramHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {support.instagramLabel}
            </a>
          ) : (
            <span className="kosy-footer-instagram" aria-disabled="true">
              {support.instagramLabel}
            </span>
          ))}
      </div>
    </section>
  );
}
