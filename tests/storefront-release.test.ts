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
  products: [{ slug: "tapkin-pet-tag", name: "Tapkin Pet Tag" }],
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

  it("rejects an unrelated JSON file or unsafe media key", () => {
    expect(storefrontReleaseSchema.safeParse({ ...release, kind: "backup" }).success).toBe(false);
    expect(storefrontReleaseSchema.safeParse({ ...release, assets: [{ storageKey: "../secrets", mimeType: "image/png", byteSize: 1, width: 1, height: 1, bytesBase64: "AA==" }] }).success).toBe(false);
  });
});
