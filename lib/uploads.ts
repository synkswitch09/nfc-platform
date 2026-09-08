import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const formats = [
  { mime: "image/png", extension: "png", matches: (data: Uint8Array) => data.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => data[index] === byte) },
  { mime: "image/jpeg", extension: "jpg", matches: (data: Uint8Array) => data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  { mime: "image/webp", extension: "webp", matches: (data: Uint8Array) => data.length > 12 && Buffer.from(data.slice(0, 4)).toString() === "RIFF" && Buffer.from(data.slice(8, 12)).toString() === "WEBP" },
];

export function detectProductImageFormat(bytes: Uint8Array) { return formats.find(item => item.matches(bytes)); }

export function uploadDirectory() { return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads")); }

export async function validateAndStoreImage(file: File) {
  if (!file.size || file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error("IMAGE_SIZE");
  const bytes = new Uint8Array(await file.arrayBuffer()); const format = detectProductImageFormat(bytes);
  if (!format || file.type !== format.mime) throw new Error("IMAGE_FORMAT");
  const storageKey = `${randomUUID()}.${format.extension}`; const directory = uploadDirectory();
  await mkdir(directory, { recursive: true }); await writeFile(path.join(/* turbopackIgnore: true */ directory, storageKey), bytes, { flag: "wx", mode: 0o640 });
  return { storageKey, mimeType: format.mime, byteSize: bytes.byteLength };
}

export async function readStoredImage(storageKey: string) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(storageKey)) return null;
  return readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ uploadDirectory(), storageKey)).catch(() => null);
}

export async function deleteStoredImage(storageKey: string) { await unlink(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ uploadDirectory(), storageKey)).catch(() => undefined); }
