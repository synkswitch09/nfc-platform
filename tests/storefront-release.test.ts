import { describe, expect, it } from "vitest";
import {
  STOREFRONT_RELEASE_KIND,
  STOREFRONT_RELEASE_VERSION,
  storefrontReleaseSchema,
} from "@/lib/storefront-release";

const release = {
  kind: STOREFRONT_RELEASE_KIND,
  version: STOREFRONT_RELEASE_VERSION,
  generatedAt: "2026-09-17T00:00:00.000Z",
  source: { storeSlug: "tapkin" },
  store: { displayName: "Tapkin" },
  categories: [{ slug: "pets", name: "Pets" }],
  pages: [{ slug: "terms", name: "Terms", kind: "LEGAL" }],
  products: [{ slug: "tapkin-pet-tag", name: "Tapkin Pet Tag", description: "Personalised NFC pet tag", type: "PET", brand: "Tapkin" }],
  categoryImages: [],
  assets: [],
};

describe("storefront release validation", () => {
  it("accepts a versioned catalog and CMS release", () => {
    expect(storefrontReleaseSchema.parse(release)).toMatchObject({
      source: { storeSlug: "tapkin" },
      categories: [{ slug: "pets" }],
    });
  });

  it("keeps product detail configuration and category accents in catalog releases", () => {
    const parsed = storefrontReleaseSchema.parse({ ...release,
      categories: [{ ...release.categories[0], highlightColour: "#A4DBE8" }],
      products: [{ ...release.products[0], detailConfig: { showHighlights: false, sections: [{ title: "Care", text: "Wipe gently." }], video: { enabled: true, url: "https://www.instagram.com/reel/example/", imageUrl: "/api/media/production-kosykin-00000000-0000-4000-8000-000000000001.webp" } } }],
    });
    expect(parsed.categories[0].highlightColour).toBe("#A4DBE8");
    expect(parsed.products[0].detailConfig).toMatchObject({ showHighlights: false, sections: [{ title: "Care", text: "Wipe gently." }], video: { imageUrl: "/api/media/production-kosykin-00000000-0000-4000-8000-000000000001.webp" } });
  });

  it("preserves the Home page's negative sort order during export and import", () => {
    const parsed = storefrontReleaseSchema.parse({
      ...release,
      pages: [{ slug: "home", name: "Home", kind: "HOME", sortOrder: -1 }],
    });
    expect(parsed.pages[0].sortOrder).toBe(-1);
  });

  it("rejects an unrelated JSON file or unsafe media key", () => {
    expect(storefrontReleaseSchema.safeParse({ ...release, kind: "backup" }).success).toBe(false);
    expect(storefrontReleaseSchema.safeParse({ ...release, assets: [{ storageKey: "../secrets", mimeType: "image/png", byteSize: 1, width: 1, height: 1, bytesBase64: "AA==" }] }).success).toBe(false);
  });
});
