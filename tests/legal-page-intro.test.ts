import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalPageIntro } from "@/components/legal-page-intro";
import type { Storefront } from "@/lib/storefront";
import { parseFooterConfig } from "@/lib/site-chrome";

const policySlugs = ["terms", "shipping-delivery", "returns-cancellations", "custom-designs", "customer-points"];
const store = {
  defaultLocale: "en",
  footerConfig: parseFooterConfig({ policyLinks: policySlugs.map((slug, order) => ({
    id: `00000000-0000-4000-8000-${String(order).padStart(12, "0")}`,
    label: slug, href: `/${slug}`, visible: true, order,
  })) }),
} as Storefront;

describe("Legal page policy navigation", () => {
  it.each(policySlugs)("keeps all five destinations available from %s", slug => {
    const html = renderToStaticMarkup(createElement(LegalPageIntro, { name: slug, store, slug }));
    expect(html).toContain('aria-label="Policies"');
    for (const destination of policySlugs) expect(html).toContain(`href="/${destination}"`);
    expect(html).toMatch(new RegExp(`(?=[^>]*href="/${slug}")(?=[^>]*aria-current="page")[^>]*>`));
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("keeps Privacy Policy outside this menu even if it is added to the CMS list", () => {
    const privacyStore = { ...store, footerConfig: { ...store.footerConfig, policyLinks: [
      ...store.footerConfig.policyLinks,
      { id: "00000000-0000-4000-8000-000000000099", label: "Privacy", href: "/privacy", visible: true, order: 99 },
    ] } };
    const html = renderToStaticMarkup(createElement(LegalPageIntro, { name: "Privacy policy", store: privacyStore, slug: "privacy" }));
    expect(html).toContain("Privacy policy");
    expect(html).not.toContain('aria-label="Policies"');
  });

  it("does not add the menu to unrelated pages", () => {
    const html = renderToStaticMarkup(createElement(LegalPageIntro, { name: "Help", store, slug: "support" }));
    expect(html).not.toContain('aria-label="Policies"');
  });
});
