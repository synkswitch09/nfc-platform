import { describe, expect, it } from "vitest";
import {
  compactLocaleName,
  getSystemCopy,
  languageAlternates,
  localizedPath,
  localizeContentPage,
  resolveLocale,
} from "@/lib/i18n";

describe("storefront localization", () => {
  it("uses compact locale labels in crowded navigation", () => {
    expect(compactLocaleName("en-AU")).toBe("English (AU)");
    expect(compactLocaleName("es-CO")).toBe("Español (CO)");
  });
  it("selects only enabled locales and falls back to the Store default", () => {
    expect(resolveLocale("es", ["en-AU", "es-CO"], "en-AU")).toBe("es-CO");
    expect(resolveLocale("fr-FR", ["en-AU", "es-CO"], "en-AU")).toBe("en-AU");
    expect(getSystemCopy("es-CO").checkout).toBe("Pagar");
  });

  it("produces stable localized URLs and hreflang mappings", () => {
    expect(localizedPath("/pets?ref=nav", "es-CO", "en-AU")).toBe(
      "/pets?ref=nav&locale=es-CO",
    );
    expect(localizedPath("/pets", "en-AU", "en-AU")).toBe("/pets");
    expect(
      languageAlternates(
        "/pets",
        "https://tapkin.example",
        ["en-AU", "es-CO"],
        "en-AU",
      ),
    ).toEqual({
      "en-AU": "https://tapkin.example/pets",
      "es-CO": "https://tapkin.example/pets?locale=es-CO",
    });
  });

  it("localizes CMS metadata and section content with field-level fallback", () => {
    const page = {
      name: "Pets",
      seoTitle: "Pet tags",
      seoDescription: "Default copy",
      translations: [
        {
          locale: "es-CO",
          name: "Mascotas",
          seoTitle: "Placas para mascotas",
          seoDescription: null,
        },
      ],
      sections: [
        {
          id: "hero",
          content: { headline: "Find them" },
          translations: [
            { locale: "es-CO", content: { headline: "Encuéntralos" } },
          ],
        },
        { id: "faq", content: { headline: "Questions" }, translations: [] },
      ],
    };
    expect(localizeContentPage(page, "es-CO", "en-AU")).toMatchObject({
      name: "Mascotas",
      seoTitle: "Placas para mascotas",
      seoDescription: "Default copy",
      sections: [
        { content: { headline: "Encuéntralos" } },
        { content: { headline: "Questions" } },
      ],
    });
  });
});
