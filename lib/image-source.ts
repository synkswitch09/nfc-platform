import { isSafeStorageKey } from "@/lib/storage/keys";

const internalMediaPrefix = "/api/media/";

export function isSafeImageSource(value: string) {
  if (!value) return true;
  // Versioned images shipped with the site work across staging and production
  // without baking either environment's hostname into CMS content.
  if (value.startsWith("/images/")) {
    return /^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpg|webp)$/.test(value);
  }
  if (value.startsWith(internalMediaPrefix)) {
    const storageKey = value.slice(internalMediaPrefix.length);
    return /\.(?:png|jpg|webp)$/.test(storageKey) && isSafeStorageKey(storageKey);
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
