import { randomUUID } from "node:crypto";
import path from "node:path";
import { getRuntimeConfig } from "@/lib/config";
import { createStorageKey, isSafeStorageKey } from "@/lib/storage/keys";
import { getStorageProvider } from "@/lib/storage";

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const formats = [
  { mime: "image/png", extension: "png", matches: (data: Uint8Array) => data.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => data[index] === byte) },
  { mime: "image/jpeg", extension: "jpg", matches: (data: Uint8Array) => data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  { mime: "image/webp", extension: "webp", matches: (data: Uint8Array) => data.length > 12 && Buffer.from(data.slice(0, 4)).toString() === "RIFF" && Buffer.from(data.slice(8, 12)).toString() === "WEBP" },
];

export function detectProductImageFormat(bytes: Uint8Array) { return formats.find(item => item.matches(bytes)); }

function uint16be(bytes: Uint8Array, offset: number) { return (bytes[offset] << 8) | bytes[offset + 1]; }
function uint24le(bytes: Uint8Array, offset: number) { return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16); }

export function productImageDimensions(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png" && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/jpeg") {
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const segmentLength = uint16be(bytes, offset + 2);
      if (segmentLength < 2 || offset + segmentLength + 2 > bytes.length) return null;
      if (startOfFrame.has(marker)) return { height: uint16be(bytes, offset + 5), width: uint16be(bytes, offset + 7) };
      offset += segmentLength + 2;
    }
  }
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const chunk = Buffer.from(bytes.slice(12, 16)).toString();
    if (chunk === "VP8X") return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 };
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    if (chunk === "VP8L" && bytes[20] === 0x2f) return { width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8), height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10) };
  }
  return null;
}

export function uploadDirectory() { return path.resolve(/* turbopackIgnore: true */ getRuntimeConfig().storage.uploadDir ?? path.join(process.cwd(), "data", "uploads")); }

export async function validateAndStoreImage(file: File, storeSlug: string, purpose = "product-image") {
  if (!file.size || file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error("IMAGE_SIZE");
  const bytes = new Uint8Array(await file.arrayBuffer()); const format = detectProductImageFormat(bytes);
  if (!format || file.type !== format.mime) throw new Error("IMAGE_FORMAT");
  const dimensions = productImageDimensions(bytes, format.mime);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 10_000 || dimensions.height > 10_000 || dimensions.width * dimensions.height > 40_000_000) throw new Error("IMAGE_DIMENSIONS");
  const runtime = getRuntimeConfig();
  const storageKey = createStorageKey(runtime.appEnv, storeSlug, randomUUID(), format.extension as "png" | "jpg" | "webp");
  await getStorageProvider(runtime).put(storageKey, bytes, { contentType: format.mime, cacheControl: "public, max-age=31536000, immutable", metadata: { environment: runtime.appEnv, store: storeSlug, purpose } });
  return { storageKey, mimeType: format.mime, byteSize: bytes.byteLength, ...dimensions };
}

export async function readStoredImage(storageKey: string) {
  if (!isSafeStorageKey(storageKey)) return null;
  return getStorageProvider().get(storageKey);
}

export async function deleteStoredImage(storageKey: string) { if (isSafeStorageKey(storageKey)) await getStorageProvider().delete(storageKey); }
