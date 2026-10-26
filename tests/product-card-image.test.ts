import { describe, expect, it } from "vitest";
import { cardColourImage } from "@/lib/product-card-image";
describe("CMS colour previews", () => {
  const product = { options: [{ code: "colour", type: "COLOUR", values: [{ id: "blue", value: "bb", label: "Baby Blue" }] }], variants: [{ id: "variant", imageId: "photo", optionSelection: { colour: "bb" } }], images: [{ id: "generic", url: "/pink", altText: "Pink" }, { id: "photo", url: "/blue", altText: "Blue" }] };
  it("resolves the variant primary image without relying on image order", () => {
    expect(cardColourImage(product, "bb")?.url).toBe("/blue");
  });
  it("uses explicitly colour-associated photos and leaves missing colours unchanged", () => {
    expect(cardColourImage({ ...product, images: [...product.images, { id: "gallery", url: "/blue-gallery", altText: "Blue", optionValueId: "blue" }] }, "bb")?.url).toBe("/blue-gallery");
    expect(cardColourImage(product, "pink")).toBeUndefined();
  });
});
