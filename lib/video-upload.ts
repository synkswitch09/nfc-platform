import { randomUUID } from "node:crypto";
import { getRuntimeConfig } from "@/lib/config";
import { createStorageKey } from "@/lib/storage/keys";
import { getStorageProvider } from "@/lib/storage";

export const MAX_PRODUCT_VIDEO_BYTES = 50 * 1024 * 1024;

export function validateMp4(bytes: Uint8Array) {
  if (bytes.byteLength < 24 || bytes.byteLength > MAX_PRODUCT_VIDEO_BYTES) throw new Error("VIDEO_SIZE");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxLength = view.getUint32(0);
  const boxName = new TextDecoder().decode(bytes.subarray(4, 8));
  const brand = new TextDecoder().decode(bytes.subarray(8, 12));
  if (boxName !== "ftyp" || boxLength < 16 || boxLength > bytes.byteLength || !["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "qt  "].includes(brand)) throw new Error("VIDEO_FORMAT");
  let offset = 0; let hasMedia = false;
  while (offset + 8 <= bytes.byteLength) {
    const declared = view.getUint32(offset); const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    const headerLength = declared === 1 ? 16 : 8;
    const length = declared === 0 ? bytes.byteLength - offset : declared === 1 && offset + 16 <= bytes.byteLength ? Number(view.getBigUint64(offset + 8)) : declared;
    if (!Number.isSafeInteger(length) || length < headerLength || offset + length > bytes.byteLength) throw new Error("VIDEO_FORMAT");
    if (type === "mdat" && length > headerLength) hasMedia = true;
    offset += length;
  }
  if (offset !== bytes.byteLength || !hasMedia) throw new Error("VIDEO_FORMAT");
}

export async function storeProductVideo(file: File, storeSlug: string) {
  if (!file.size || file.size > MAX_PRODUCT_VIDEO_BYTES) throw new Error("VIDEO_SIZE");
  if (file.type !== "video/mp4") throw new Error("VIDEO_FORMAT");
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateMp4(bytes);
  const runtime = getRuntimeConfig();
  const storageKey = createStorageKey(runtime.appEnv, storeSlug, randomUUID(), "mp4");
  await getStorageProvider(runtime).put(storageKey, bytes, { contentType: "video/mp4", cacheControl: "public, max-age=31536000, immutable", metadata: { environment: runtime.appEnv, store: storeSlug, purpose: "variant-video" } });
  return { storageKey, byteSize: bytes.byteLength };
}
