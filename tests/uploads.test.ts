import { describe, expect, it } from "vitest";
import { detectProductImageFormat, productImageDimensions } from "@/lib/uploads";

describe("product image validation", () => {
  it("recognises genuine image signatures", () => {
    expect(detectProductImageFormat(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]))?.mime).toBe("image/png");
    expect(detectProductImageFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
  });
  it("rejects executable or renamed content", () => {
    expect(detectProductImageFormat(new TextEncoder().encode("<script>alert(1)</script>"))).toBeUndefined();
  });
  it("reads PNG dimensions before accepting an upload", () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 4, 0, 0, 0, 3, 0]);
    expect(productImageDimensions(png, "image/png")).toEqual({ width: 1024, height: 768 });
  });
});
