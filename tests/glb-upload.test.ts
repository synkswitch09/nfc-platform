import { describe, expect, it } from "vitest";
import { validateGlb } from "@/lib/glb-upload";

function glb(document: object) {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const padded = Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(20 + padded); const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, padded, true); view.setUint32(16, 0x4e4f534a, true);
  bytes.set(json, 20); bytes.fill(32, 20 + json.length);
  return bytes;
}

describe("GLB uploads", () => {
  it("allows a self-contained GLB v2", () => expect(() => validateGlb(glb({ asset: { version: "2.0" }, buffers: [] }))).not.toThrow());
  it("rejects external textures and buffers", () => {
    expect(() => validateGlb(glb({ asset: { version: "2.0" }, images: [{ uri: "https://example.com/tracker.png" }] }))).toThrow("GLB_EXTERNAL_ASSET");
    expect(() => validateGlb(glb({ asset: { version: "2.0" }, buffers: [{ uri: "../other.bin" }] }))).toThrow("GLB_EXTERNAL_ASSET");
  });
  it("rejects a fake binary", () => expect(() => validateGlb(new Uint8Array(24))).toThrow("GLB_FORMAT"));
});
