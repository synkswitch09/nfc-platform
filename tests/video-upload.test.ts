import { describe, expect, it } from "vitest";
import { createStorageKey, isSafeStorageKey } from "@/lib/storage/keys";
import { validateMp4 } from "@/lib/video-upload";

function box(name: string, body: Uint8Array) {
  const bytes = new Uint8Array(body.length + 8);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(new TextEncoder().encode(name), 4); bytes.set(body, 8);
  return bytes;
}

describe("variant video upload", () => {
  const valid = new Uint8Array([...box("ftyp", new TextEncoder().encode("isom\0\0\0\0")), ...box("mdat", new Uint8Array(12))]);
  it("accepts an MP4 container with media and a store-scoped key", () => {
    expect(() => validateMp4(valid)).not.toThrow();
    expect(isSafeStorageKey(createStorageKey("staging", "kosykin", "00000000-0000-4000-8000-000000000001", "mp4"))).toBe(true);
  });
  it("rejects a renamed image, a header-only file and malformed box lengths", () => {
    expect(() => validateMp4(new TextEncoder().encode("not an mp4 video"))).toThrow();
    expect(() => validateMp4(box("ftyp", new TextEncoder().encode("isom\0\0\0\0")))).toThrow();
    const damaged = valid.slice(); new DataView(damaged.buffer).setUint32(16, 100000);
    expect(() => validateMp4(damaged)).toThrow();
  });
});
