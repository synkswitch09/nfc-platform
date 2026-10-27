import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductDetailBlocks } from "@/components/product-detail-blocks";
import { productDetailSchema, parseProductDetail, visibleProductBlocks, recommendedProducts, categoryTextColour } from "@/lib/product-detail";
import { productValidationFeedback } from "@/lib/product-validation-feedback";
import { kosykinShopCollections } from "@/lib/kosykin-shop";
vi.mock("next/image", () => ({ default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => <img {...props} /> }));

describe("optional product detail content", () => {
  it("keeps old products usable without requiring new optional content", () => {
    const config = productDetailSchema.parse({});
    expect(config.buttons).toEqual({ cartBackground: "#243247", cartText: "#ffffff", buyBackground: "#E8CB67", buyText: "#243247" });
    expect(renderToStaticMarkup(<ProductDetailBlocks config={config} />)).toBe("");
    expect(productDetailSchema.safeParse({ video: { enabled: true, url: "", imageUrl: "" }, highlights: [{ title: "", text: "" }], sections: [{ title: "", text: "" }] }).success).toBe(true);
    expect(parseProductDetail(null)).toEqual(config);
  });
  it("removes disabled and empty blocks entirely", () => {
    const config = parseProductDetail({ highlights: [{ title: "", text: "No heading" }, { title: "Made locally", visible: false }, { title: "Small footprint", text: "Fits on a desk" }], sections: [{ title: "Care", text: "" }, { title: "Material", text: "PLA" }] });
    expect(visibleProductBlocks(config).highlights.map(item => item.title)).toEqual(["Small footprint"]);
    expect(visibleProductBlocks(config).sections.map(item => item.title)).toEqual(["Material"]);
    expect(renderToStaticMarkup(<ProductDetailBlocks config={{ ...config, showHighlights: false, showDetails: false }} />)).toBe("");
  });
  it("renders an external Instagram card only when enabled and populated", () => {
    const config = parseProductDetail({ video: { enabled: true, url: "https://www.instagram.com/reel/abc/", title: "See the tray", text: "A closer look" } });
    const markup = renderToStaticMarkup(<ProductDetailBlocks config={config} />);
    expect(markup).toContain('href="https://www.instagram.com/reel/abc/"');
    expect(markup).toContain("noopener noreferrer");
    expect(markup).toContain("See the tray");
    expect(markup).not.toContain("iframe");
    expect(renderToStaticMarkup(<ProductDetailBlocks config={{ ...config, video: { ...config.video, enabled: false } }} />)).toBe("");
  });
  it("rejects deceptive or unsafe video links and reports the precise CMS field", () => {
    for (const url of ["javascript:alert(1)", "https://instagram.com.evil.test/reel/x", "https://example.com/reel/x"]) {
      const result = productDetailSchema.safeParse({ video: { url } });
      expect(result.success).toBe(false);
      if (!result.success) {
        const feedback = productValidationFeedback(result.error.issues.map(issue => ({ ...issue, path: ["detailConfig", ...issue.path] })));
        expect(feedback[0].path).toBe("detailConfig.video.url");
        expect(feedback[0].field).toBe("Video card — Instagram link");
      }
    }
  });
  it("uses the category CMS accent before inherited Home colours", () => {
    const collections = kosykinShopCollections([{ id: "stands", slug: "stands-holders", name: "Stands", highlightColour: "#123456" }], [{ categorySlug: "stands-holders", iconBackgroundColour: "#ffffff" }]);
    expect(collections[0].highlightColour).toBe("#123456");
    expect(categoryTextColour("#123456")).toBe("#ffffff");
    expect(categoryTextColour("#E8CB67")).toBe("#243247");
  });
});
describe("recommended products", () => {
  it("excludes the current product, removes duplicates and limits results to four without mutating the input", () => {
    const input = ["current", "a", "b", "c", "d", "e", "a"].map(id => ({ id }));
    const snapshot = [...input];
    const result = recommendedProducts(input, "current", () => 0);
    expect(result).toHaveLength(4);
    expect(result.some(item => item.id === "current")).toBe(false);
    expect(new Set(result.map(item => item.id)).size).toBe(4);
    expect(input).toEqual(snapshot);
    expect(recommendedProducts([{ id: "current" }], "current")).toEqual([]);
  });
});
