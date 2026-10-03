import { randomUUID } from "node:crypto";
import { getRuntimeConfig } from "@/lib/config";
import { createStorageKey } from "@/lib/storage/keys";
import { getStorageProvider } from "@/lib/storage";

export const MAX_GLB_BYTES = 20 * 1024 * 1024;
export function validateGlb(bytes: Uint8Array) {
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_GLB_BYTES) throw new Error("GLB_SIZE");
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) throw new Error("GLB_FORMAT");
  const jsonSize = header.getUint32(12, true);
  if (jsonSize > 2 * 1024 * 1024 || jsonSize + 20 > bytes.byteLength || header.getUint32(16, true) !== 0x4e4f534a) throw new Error("GLB_FORMAT");
  let document: { asset?: { version?: string }; buffers?: { uri?: string }[]; images?: { uri?: string }[] };
  try { document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(20, 20 + jsonSize))); }
  catch { throw new Error("GLB_FORMAT"); }
  if (document.asset?.version !== "2.0" || document.buffers?.some(item => item.uri) || document.images?.some(item => item.uri && !item.uri.startsWith("data:image/"))) throw new Error("GLB_EXTERNAL_ASSET");
}

export async function storeGlb(file: File, storeSlug: string) {
  if (!file.size || file.size > MAX_GLB_BYTES) throw new Error("GLB_SIZE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateGlb(bytes);
  const runtime = getRuntimeConfig();
  const storageKey = createStorageKey(runtime.appEnv, storeSlug, randomUUID(), "glb");
  await getStorageProvider(runtime).put(storageKey, bytes, { contentType: "model/gltf-binary", cacheControl: "public, max-age=31536000, immutable", metadata: { environment: runtime.appEnv, store: storeSlug, purpose: "variant-3d-model" } });
  return storageKey;
}
