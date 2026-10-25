import React from "react";
import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/image", () => ({
  default: ({
    unoptimized: _u,
    priority: _p,
    ...props
  }: Record<string, unknown>) => React.createElement("img", props),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("a", props, children),
}));
import { SiteFooter } from "@/components/site-footer";
import { KosykinFooterSupport } from "@/components/kosykin-footer-support";
import { StorefrontIconsProvider } from "@/components/storefront-icon";
import { parseFooterConfig } from "@/lib/site-chrome";
import { getSystemCopy } from "@/lib/i18n";
const profiles = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    label: "Instagram",
    href: "https://instagram.com/example",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    label: "Facebook",
    href: "https://facebook.com/example",
  },
];
export function footerFixture(
  overrides: Record<string, unknown> = {},
  kosykin = true,
) {
  const config = parseFooterConfig({ socialProfiles: profiles, ...overrides });
  const common = {
    config,
    socialLinks: {},
    storeName: kosykin ? "Kosykin" : "Tapkin",
    locale: "en-AU",
    defaultLocale: "en-AU",
  };
  return renderToStaticMarkup(
    <StorefrontIconsProvider overrides={{}} kosykin={kosykin}>
      <SiteFooter
        {...common}
        storeLogoUrl="/images/kosykin/logo.png"
        pages={[{ name: "Frequently Asked Questions", slug: "faq", order: 0 }]}
        nfcEnabled={!kosykin}
        copy={getSystemCopy("en-AU")}
        kosykinLayout={kosykin}
        support={kosykin ? <KosykinFooterSupport {...common} /> : undefined}
      />
    </StorefrontIconsProvider>,
  );
}
it("keeps one footer with brand, socials and both actions in cream and only legal content in navy", () => {
  const html = footerFixture({
    support: { instagramHref: "https://ig.me/m/example" },
  });
  expect(html.match(/<footer /g)).toHaveLength(1);
  expect(html.match(/class="kosy-footer-brand"/g)).toHaveLength(1);
  const [cream, legal] = html.split('<div class="kosy-footer-legal">');
  expect(cream).toContain('href="/support"');
  expect(cream).toContain('href="https://ig.me/m/example"');
  expect(cream).toContain('href="https://instagram.com/example"');
  expect(cream).toContain('href="https://facebook.com/example"');
  expect(cream).toContain("Contact us");
  expect(cream).toContain("We reply within 1 day.");
  expect(legal).not.toContain("<img");
  expect(legal).not.toContain("footer-socials");
  expect(legal.indexOf('href="/privacy"')).toBeLessThan(
    legal.indexOf('href="/support"'),
  );
  expect(legal.indexOf('href="/support"')).toBeLessThan(
    legal.indexOf('href="/terms"'),
  );
  expect(legal.indexOf('href="/terms"')).toBeLessThan(
    legal.indexOf('href="/faq"'),
  );
});
it("leaves an empty Instagram destination as a non-clickable preview and allows hiding it", () => {
  const html = footerFixture();
  expect(html).toContain('class="kosy-footer-instagram" aria-disabled="true"');
  expect(html).not.toContain('href="#"');
  expect(footerFixture({ support: { instagramVisible: false } })).not.toContain(
    "kosy-footer-instagram",
  );
  expect(footerFixture({ support: { enabled: false } })).not.toContain(
    'class="kosy-footer-support"',
  );
});
it("keeps Tapkin's existing footer identity and links", () => {
  const html = footerFixture({}, false);
  expect(html).toContain('class="footer-brand"');
  expect(html).toContain('class="footer-socials"');
  expect(html).not.toContain("kosy-footer-legal");
});
it("rejects unsafe message URLs and provides backward-compatible defaults", () => {
  expect(parseFooterConfig({}).support.contactLabel).toBe("Contact us");
  for (const instagramHref of [
    "javascript:alert(1)",
    "//evil.test",
    "http://example.com",
  ])
    expect(() => parseFooterConfig({ support: { instagramHref } })).toThrow();
});
