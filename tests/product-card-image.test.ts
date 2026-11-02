import { describe, expect, it } from "vitest";
import { cardColourImage, cardCoverImages, cardCoverImage, cardHoverImage } from "@/lib/product-card-image";
describe("CMS colour previews", () => {
  const gallery = {
    options: [{ code: "colour", type: "COLOUR", values: ["pink", "blue"].map(value => ({ id: value, value, label: value })) }],
    variants: [{ id: "pink-variant", imageId: "pink-front", optionSelection: { colour: "pink" } }, { id: "blue-variant", imageId: "blue-front", optionSelection: { colour: "blue" } }],
    images: [
      { id: "pink-front", url: "/pink-front", altText: "Pink", optionValueId: "pink" },
      { id: "blue-front", url: "/blue-front", altText: "Blue", optionValueId: "blue" },
      { id: "pink-side", url: "/pink-side", altText: "Pink side", variantId: "pink-variant" },
      { id: "blue-side", url: "/blue-side", altText: "Blue side", variantId: "blue-variant" },
    ],
  };
  it("hovers the second photo of the randomly selected colour, even with interleaved galleries", () => {
    for (const colour of ["pink", "blue"]) {
      const cover = cardColourImage(gallery, colour)!;
      expect(cardHoverImage(gallery, cover)?.url).toBe(`/${colour}-side`);
      expect(cardColourImage(gallery, colour)).toBe(cover);
    }
  });
  it("uses the first photo of another colour only when the current colour has no second view", () => {
    const product = { ...gallery, images: gallery.images.filter(image => image.id !== "blue-side") };
    expect(cardHoverImage(product, cardColourImage(product, "blue"))?.url).toBe("/pink-front");
    const single = { ...gallery, images: gallery.images.filter(image => image.id === "blue-front") };
    expect(cardHoverImage(single, single.images[0])).toBeUndefined();
    expect(cardHoverImage(gallery)).toBeUndefined();
  });
  it("matches a cover assigned by variant image ID and retains unassociated legacy galleries", () => {
    const product = { ...gallery, images: gallery.images.map(image => ({ ...image, optionValueId: undefined })) };
    expect(cardHoverImage(product, product.images[1])?.url).toBe("/blue-side");
    const legacy = { variants: [], images: [{ url: "/first", altText: "First" }, { url: "/second", altText: "Second" }] };
    expect(cardHoverImage(legacy, legacy.images[0])?.url).toBe("/second");
  });
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
