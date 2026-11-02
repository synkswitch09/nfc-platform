import { describe, expect, it } from "vitest";
import { cardColourImage, cardCoverImages, cardCoverImage } from "@/lib/product-card-image";
describe("CMS colour previews", () => {
  it("rotates photographed colours by browsing seed while keeping each product stable", () => {
    const product = {
      options: [{ code: "colour", type: "COLOUR", values: ["pink", "blue", "apricot", "missing", "disabled"].map(value => ({ id: value, value, label: value, active: value !== "disabled" })) }],
      variants: [{ id: "pink-small", imageId: "pink" }, { id: "pink-large", imageId: "pink" }],
      images: ["pink", "blue", "apricot", "disabled"].map(id => ({ id, url: `/${id}`, altText: id, optionValueId: id })),
    };
    expect(cardCoverImages(product).map(image => image.url)).toEqual(["/pink", "/blue", "/apricot"]);
    expect(cardCoverImages(product, ["blue"]).map(image => image.url)).toEqual(["/blue"]);
    expect(cardCoverImage(product, "stand", null, ["blue"])?.url).toBe("/blue");
    expect(cardCoverImage(product, "stand", null)?.url).toBe("/pink");
    expect(cardCoverImage(product, "stand", 0.3)).toEqual(cardCoverImage(product, "stand", 0.3));
    expect(new Set(Array.from({ length: 60 }, (_, i) => cardCoverImage(product, "stand", i / 60)?.url)).size).toBe(3);
    expect(new Set(Array.from({ length: 30 }, (_, i) => cardCoverImage(product, `product-${i}`, 0.3)?.url)).size).toBe(3);
    expect(cardCoverImage({ images: [], variants: [] }, "empty", 0.3)).toBeUndefined();
    expect(cardCoverImages({ images: [{ url: "/default", altText: "Default" }], variants: [] })).toHaveLength(1);
  });
  const product = { options: [{ code: "colour", type: "COLOUR", values: [{ id: "blue", value: "bb", label: "Baby Blue" }] }], variants: [{ id: "variant", imageId: "photo", optionSelection: { colour: "bb" } }], images: [{ id: "generic", url: "/pink", altText: "Pink" }, { id: "photo", url: "/blue", altText: "Blue" }] };
  it("resolves the variant primary image without relying on image order", () => {
    expect(cardColourImage(product, "bb")?.url).toBe("/blue");
  });
  it("uses explicitly colour-associated photos and leaves missing colours unchanged", () => {
    expect(cardColourImage({ ...product, images: [...product.images, { id: "gallery", url: "/blue-gallery", altText: "Blue", optionValueId: "blue" }] }, "bb")?.url).toBe("/blue-gallery");
    expect(cardColourImage(product, "pink")).toBeUndefined();
  });
});
