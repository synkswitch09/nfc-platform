import { isSafeStorageKey } from "@/lib/storage/keys";

const internalMediaPrefix = "/api/media/";

export function isSafeImageSource(value: string) {
  if (!value) return true;
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
