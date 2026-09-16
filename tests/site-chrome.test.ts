import { describe, expect, it } from "vitest";
import {
  isNavigationActive,
  parseFooterConfig,
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
        socialIcons: { instagram: "https://cdn.example.com/footer-instagram.png" },
      }),
    ).toMatchObject({
      taglineTypography: { family: "INTER", weight: "BOLD", italic: "ITALIC", sizePx: 18 },
      socialIcons: { instagram: "https://cdn.example.com/footer-instagram.png" },
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
