import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PrivacySettingsLink } from "@/components/privacy-settings-link";

it("provides a usable privacy-settings link before browser hydration", () => {
  const html = renderToStaticMarkup(createElement(PrivacySettingsLink, { href: "/privacy" }));
  expect(html).toContain('href="/privacy?preferences=open#privacy-settings"');
  expect(html).toContain("Privacy &amp; cookie settings");
});
