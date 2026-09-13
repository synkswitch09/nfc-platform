import { describe, expect, it } from "vitest";
import {
  isNavigationActive,
  parseFooterConfig,
  parseFooterLinks,
  parseHeaderConfig,
} from "@/lib/site-chrome";

describe("site chrome configuration", () => {
  it("provides safe minimal header and footer defaults", () => {
    expect(parseHeaderConfig({}).shopLabel).toBe("Shop");
    expect(parseHeaderConfig({}).faqHref).toBe("/faq");
    expect(parseHeaderConfig({}).categoriesLabel).toBe("Categories");
    expect(parseHeaderConfig({}).showCart).toBe(true);
    expect(parseHeaderConfig({}).shopBackgroundColour).toBe("");
    expect(parseFooterConfig({}).privacyLabel).toBe("Privacy Policy");
    expect(parseFooterConfig({}).backgroundColour).toBe("");
  });

  it("accepts controlled chrome colours and rejects style injection", () => {
    expect(
      parseHeaderConfig({
        backgroundColour: "#fffaf5",
        shopBackgroundColour: "#17212b",
      }),
    ).toMatchObject({
      backgroundColour: "#fffaf5",
      shopBackgroundColour: "#17212b",
    });
    expect(
      parseFooterConfig({ textColour: "#67716f", linkColour: "#17212b" }),
    ).toMatchObject({ textColour: "#67716f", linkColour: "#17212b" });
    expect(() => parseHeaderConfig({ activeColour: "red" })).toThrow();
    expect(() =>
      parseFooterConfig({ borderColour: "1px solid red" }),
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
    expect(
      parseFooterLinks(
        "About | /about\nBroken\nHelp | https://example.com/help",
      ),
    ).toEqual([
      { label: "About", href: "/about", visible: true, order: 0 },
      {
        label: "Help",
        href: "https://example.com/help",
        visible: true,
        order: 2,
      },
    ]);
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
