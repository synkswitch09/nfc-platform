import { describe, expect, it } from "vitest";
import { contentPageSchema } from "@/lib/content-page-validation";

const valid = { name: "Spring campaign", slug: "spring-campaign", kind: "CAMPAIGN", status: "DRAFT", sortOrder: 0, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false };

describe("content page validation", () => {
  it("accepts a typed non-category page", () => expect(contentPageSchema.parse(valid)).toMatchObject({ kind: "CAMPAIGN", slug: "spring-campaign" }));
  it("keeps category pages in the category administration boundary", () => expect(() => contentPageSchema.parse({ ...valid, kind: "CATEGORY" })).toThrow());
  it("keeps page placement explicit and prevents a duplicate Home link", () => {
    expect(contentPageSchema.parse({ ...valid, showInHeader: true, headerLabel: "About", navigationOrder: 15 })).toMatchObject({ showInHeader: true, headerLabel: "About", navigationOrder: 15 });
    expect(() => contentPageSchema.parse({ ...valid, kind: "HOME", showInHeader: true })).toThrow();
  });
  it("rejects route collisions and unsafe metadata", () => {
    expect(() => contentPageSchema.parse({ ...valid, slug: "checkout" })).toThrow();
    expect(() => contentPageSchema.parse({ ...valid, canonicalUrl: "javascript:alert(1)" })).toThrow();
    expect(() => contentPageSchema.parse({ ...valid, ogImageUrl: "/api/admin/users" })).toThrow();
  });
  it("allows the dedicated legal page routes", () => {
    expect(
      contentPageSchema.parse({
        ...valid,
        name: "Terms and conditions",
        slug: "terms",
        kind: "LEGAL",
      }),
    ).toMatchObject({ kind: "LEGAL", slug: "terms" });
    expect(
      contentPageSchema.parse({
        ...valid,
        name: "Privacy policy",
        slug: "privacy",
        kind: "LEGAL",
      }),
    ).toMatchObject({ kind: "LEGAL", slug: "privacy" });
  });
});
