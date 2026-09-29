import { describe, expect, it } from "vitest";
import { clearMediaReference } from "@/lib/media-references";

describe("clearMediaReference", () => {
  const image = "/api/media/development-tapkin-11111111-1111-1111-1111-111111111111.png";

  it("clears every exact media reference while preserving surrounding content", () => {
    const result = clearMediaReference(
      {
        imageUrl: image,
        caption: "Keep this caption",
        items: [{ imageUrl: image }, { imageUrl: "https://example.com/keep.png" }],
      },
      image,
    );

    expect(result.changed).toBe(true);
    expect(result.value).toEqual({
      imageUrl: "",
      caption: "Keep this caption",
      items: [{ imageUrl: "" }, { imageUrl: "https://example.com/keep.png" }],
    });
  });

  it("does not alter unrelated values", () => {
    const value = { imageUrl: "https://example.com/keep.png" };
    const result = clearMediaReference(value, image);

    expect(result.changed).toBe(false);
    expect(result.value).toBe(value);
  });
});
