import { describe, expect, it } from "vitest";
import {
  isNavigationActive,
  parseFooterConfig,
  footerSocialProfiles,
  storefrontSocialChannels,
  parseFooterLinks,
  parseHeaderConfig,
  parseHeaderLinks,
} from "@/lib/site-chrome";

describe("site chrome configuration", () => {
  it("provides safe minimal header and footer defaults", () => {
    expect(parseHeaderConfig({}).shopLabel).toBe("Shop");
    expect(parseHeaderConfig({}).faqHref).toBe("/faq");
    expect(parseHeaderConfig({}).categoriesLabel).toBe("Categories");
    expect(parseHeaderConfig({}).showCart).toBe(true);
    expect(parseHeaderConfig({}).shopBackgroundColour).toBe("");
    expect(parseHeaderConfig({}).shopBorderColour).toBe("");
    expect(parseHeaderConfig({}).fontFamily).toBe("INHERIT");
    expect(parseHeaderConfig({}).textSize).toBe("STANDARD");
    expect(parseHeaderConfig({}).shopTypography.family).toBe("INHERIT");
    expect(parseFooterConfig({}).privacyLabel).toBe("Privacy Policy");
    expect(parseFooterConfig({}).backgroundColour).toBe("");
    expect(parseFooterConfig({}).socialIcons.instagram).toBe("");
    expect(parseHeaderConfig({ faqHref: "/#faqs" }).faqHref).toBe("/faq");
  });

  it("keeps uploaded compact logos in the header configuration and rejects unsafe URLs", () => {
    const compactLogoUrl = "/api/media/staging-kosykin-11111111-1111-4111-8111-111111111111.png";
    expect(parseHeaderConfig({ compactLogoUrl }).compactLogoUrl).toBe(compactLogoUrl);
    expect(parseHeaderConfig({}).compactLogoUrl).toBe("");
    expect(() => parseHeaderConfig({ compactLogoUrl: "javascript:alert(1)" })).toThrow();
  });

  it("accepts controlled chrome colours and rejects style injection", () => {
    expect(
      parseHeaderConfig({
        backgroundColour: "#fffaf5",
        shopBackgroundColour: "#17212b",
        shopBorderColour: "#f97316",
        fontFamily: "SERIF",
        textSize: "LARGE",
      }),
    ).toMatchObject({
      backgroundColour: "#fffaf5",
      shopBackgroundColour: "#17212b",
      shopBorderColour: "#f97316",
      fontFamily: "SERIF",
      textSize: "LARGE",
    });
    expect(
      parseFooterConfig({ textColour: "#67716f", linkColour: "#17212b" }),
    ).toMatchObject({ textColour: "#67716f", linkColour: "#17212b" });
    expect(
      parseFooterConfig({
        taglineTypography: {
          family: "INTER",
          weight: "BOLD",
          italic: "ITALIC",
          sizePx: 18,
        },
        socialIcons: { instagram: "https://cdn.example.com/footer-instagram.png", tumblr: "/images/tapkin/brand/tumblr.webp" },
      }),
    ).toMatchObject({
      taglineTypography: { family: "INTER", weight: "BOLD", italic: "ITALIC", sizePx: 18 },
      socialIcons: { instagram: "https://cdn.example.com/footer-instagram.png", tumblr: "/images/tapkin/brand/tumblr.webp" },
    });
    expect(() => parseHeaderConfig({ activeColour: "red" })).toThrow();
    expect(() => parseHeaderConfig({ fontFamily: "Comic Sans" })).toThrow();
    expect(() =>
      parseFooterConfig({ borderColour: "1px solid red" }),
    ).toThrow();
    expect(() =>
      parseFooterConfig({ socialIcons: { instagram: "javascript:alert(1)" } }),
    ).toThrow();
  });

  it("rejects unsafe navigation and footer links", () => {
    expect(() =>
      parseHeaderConfig({ faqHref: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      parseFooterConfig({
        customLinks: [
          {
            label: "Unsafe",
            href: "javascript:alert(1)",
            visible: true,
            order: 0,
          },
        ],
      }),
    ).toThrow();
  });

  it("retains legacy social media and supports arbitrary ordered networks and an explicitly empty list", () => {
    const config = parseFooterConfig({ socialIcons: { facebook: "/images/tapkin/brand/footer-logo.webp" } });
    const legacy = footerSocialProfiles(config, { instagram: "https://instagram.com/example" });
    expect(legacy.map(row => row.label)).toEqual(["Instagram", "Facebook"]);
    expect(legacy[1].iconUrl).toBe("/images/tapkin/brand/footer-logo.webp");
    expect(footerSocialProfiles(parseFooterConfig({ socialProfiles: [] }), { instagram: "https://instagram.com/example" })).toEqual([]);
    const custom = parseFooterConfig({ socialProfiles: [{ id: "ba364e87-d62d-40d8-8f89-2933cdcc6c1a", label: "YouTube", href: "https://youtube.com/example", order: 2, visible: false }] });
    expect(footerSocialProfiles(custom, {})).toMatchObject([{ label: "YouTube", order: 2, visible: false }]);
    expect(() => parseFooterConfig({ socialProfiles: [{ ...custom.socialProfiles![0], href: "javascript:alert(1)" }] })).toThrow();
    expect(() => parseFooterConfig({ policyLinks: [{ label: "External", href: "https://other.example" }] })).toThrow();
  });

  it("keeps footer link order and only complete rows", () => {
    const links = parseFooterLinks(
      "About | /about\nBroken\nHelp | https://example.com/help",
    );
    expect(links).toMatchObject([
      { label: "About", href: "/about", visible: true, order: 0 },
      {
        label: "Help",
        href: "https://example.com/help",
        visible: true,
        order: 2,
      },
    ]);
    expect(links[0].id).not.toBe(links[1].id);
  });

  it("parses custom header links with audience and persistent identities", () => {
    const links = parseHeaderLinks(
      "About | /about | ALL\nOrders | /dashboard/orders | AUTHENTICATED",
    );
    expect(links).toMatchObject([
      { label: "About", href: "/about", audience: "ALL", order: 30 },
      {
        label: "Orders",
        href: "/dashboard/orders",
        audience: "AUTHENTICATED",
        order: 31,
      },
    ]);
    expect(links[0].id).not.toBe(links[1].id);
  });

  it("derives active navigation from the current route", () => {
    expect(isNavigationActive("/", "/")).toBe(true);
    expect(isNavigationActive("/pet-tags/details", "/pet-tags")).toBe(true);
    expect(isNavigationActive("/shop", "/")).toBe(false);
    expect(isNavigationActive("/faq", "/faq")).toBe(true);
    expect(isNavigationActive("/faq/shipping", "/faq")).toBe(true);
    expect(isNavigationActive("/guides", "/faq")).toBe(false);
  });
});

it("uses managed social destinations/icons for Home and never revives hidden, removed or empty links", () => {
  const legacy = { instagram: "https://instagram.com/stale", facebook: "https://facebook.com/stale" };
  const id = "ba364e87-d62d-40d8-8f89-2933cdcc6c1a";
  const profile = { id, label: "Instagram", href: "https://instagram.com/current", iconUrl: "/images/kosykin/logo.png" };
  expect(storefrontSocialChannels(parseFooterConfig({ socialProfiles: [profile] }), legacy)).toMatchObject({ links: { instagram: profile.href }, icons: { instagram: profile.iconUrl }, platforms: ["instagram"] });
  expect(storefrontSocialChannels(parseFooterConfig({ socialProfiles: [{ ...profile, href: "" }] }), legacy).links.instagram).toBe("");
  for (const profiles of [[], [{ ...profile, visible: false }]]) {
    expect(storefrontSocialChannels(parseFooterConfig({ socialProfiles: profiles }), legacy).platforms).toEqual([]);
    expect(storefrontSocialChannels(parseFooterConfig({ socialProfiles: profiles }), legacy).links).toEqual({});
  }
  expect(storefrontSocialChannels(parseFooterConfig({}), legacy).links).toEqual(legacy);
});
