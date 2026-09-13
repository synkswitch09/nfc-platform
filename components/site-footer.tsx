import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, Camera, Music2, Radio, Shapes, Users } from "lucide-react";
import type { FooterConfig } from "@/lib/site-chrome";
import { localizedPath, type SystemCopy } from "@/lib/i18n";

const socialIcons = { instagram: Camera, facebook: Users, linkedin: BriefcaseBusiness, tiktok: Music2 } as const;

export function SiteFooter({ config, storeName, storeLogoUrl, socialLinks, nfcEnabled, copy, locale, defaultLocale }: { config: FooterConfig; storeName: string; storeLogoUrl: string | null; socialLinks: Record<string, string>; nfcEnabled: boolean; copy: SystemCopy; locale: string; defaultLocale: string }) {
  const logoUrl = config.logoUrl || storeLogoUrl;
  const BrandIcon = nfcEnabled ? Radio : Shapes;
  const links = config.customLinks.filter(link => link.visible).sort((a, b) => a.order - b.order);
  const socials = Object.entries(socialLinks).filter((entry): entry is [keyof typeof socialIcons, string] => Boolean(entry[1]) && entry[0] in socialIcons);
  const copyright = config.copyright || `© ${new Date().getUTCFullYear()} ${storeName}. All rights reserved.`;
  return <footer className="site-footer">
    <div className="footer-brand">{logoUrl ? <Image className="brand-logo" src={logoUrl} alt={storeName} width={168} height={48} unoptimized /> : <span className="brand"><span className="brand-mark"><BrandIcon size={18} /></span>{storeName}</span>}{config.tagline && <p>{config.tagline}</p>}</div>
    <p className="footer-copyright">{copyright}</p>
    <div className="footer-end">
      {socials.length > 0 && <div className="footer-socials">{socials.map(([platform, href]) => { const Icon = socialIcons[platform]; return <a href={href} target="_blank" rel="noreferrer" aria-label={platform} key={platform}><Icon size={19} /></a>; })}</div>}
      <div className="footer-links">{links.map(link => link.href.startsWith("/") ? <Link href={localizedPath(link.href, locale, defaultLocale)} key={`${link.order}-${link.href}`}>{link.label}</Link> : <a href={link.href} target="_blank" rel="noreferrer" key={`${link.order}-${link.href}`}>{link.label}</a>)}{config.showTerms && <Link href={localizedPath("/terms", locale, defaultLocale)}>{locale === defaultLocale ? config.termsLabel : copy.terms}</Link>}{config.showPrivacy && <Link href={localizedPath("/privacy", locale, defaultLocale)}>{locale === defaultLocale ? config.privacyLabel : copy.privacy}</Link>}</div>
    </div>
  </footer>;
}
