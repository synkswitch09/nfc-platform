import { describe, expect, it } from "vitest";
import { contentPageSchema } from "@/lib/content-page-validation";

const valid = { name: "Spring campaign", slug: "spring-campaign", kind: "CAMPAIGN", status: "DRAFT", sortOrder: 0, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false };

describe("content page validation", () => {
  it("accepts a typed non-category page", () => expect(contentPageSchema.parse(valid)).toMatchObject({ kind: "CAMPAIGN", slug: "spring-campaign" }));
  it("keeps category pages in the category administration boundary", () => expect(() => contentPageSchema.parse({ ...valid, kind: "CATEGORY" })).toThrow());
  it("rejects route collisions and unsafe metadata", () => {
    expect(() => contentPageSchema.parse({ ...valid, slug: "checkout" })).toThrow();
    expect(() => contentPageSchema.parse({ ...valid, canonicalUrl: "javascript:alert(1)" })).toThrow();
    expect(() => contentPageSchema.parse({ ...valid, ogImageUrl: "/api/admin/users" })).toThrow();
  });
});
