import Link from "next/link";
import type { Storefront } from "@/lib/storefront";
import { localizedPath } from "@/lib/i18n";

export function LegalPageIntro({ name, store, slug, locale = store.defaultLocale }: { name: string; store: Storefront; slug: string; locale?: string }) {
  const links = store.footerConfig.policyLinks.filter(link => link.visible).sort((a, b) => a.order - b.order);
  const showPolicyNavigation = slug !== "privacy" && links.some(link => link.href === `/${slug}`);
  return <header className="section compact-section legal-page-intro">
    <h1>{name}</h1>
    {showPolicyNavigation && <nav aria-label="Policies">
      {links.map(link => <Link key={link.id} href={localizedPath(link.href, locale, store.defaultLocale)} aria-current={link.href === `/${slug}` ? "page" : undefined}>{link.label}</Link>)}
    </nav>}
  </header>;
}
