import type { AppEnvironment } from "@/lib/config";

const objectKeyPattern = /^(?:(development|staging|production)-(?:([a-z0-9]+(?:-[a-z0-9]+)*)-)?)?([0-9a-f-]{36})\.(png|jpg|webp)$/;

export function createStorageKey(environment: AppEnvironment, storeSlug: string, id: string, extension: "png" | "jpg" | "webp") {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storeSlug)) throw new Error("INVALID_STORE_SLUG");
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("INVALID_STORAGE_ID");
  return `${environment}-${storeSlug}-${id}.${extension}`;
}

export function isSafeStorageKey(key: string) { return objectKeyPattern.test(key); }

export function storageKeyEnvironment(key: string): AppEnvironment | "legacy" | null {
  const match = objectKeyPattern.exec(key);
  return !match ? null : match[1] as AppEnvironment | undefined ?? "legacy";
}

export function storageKeyStore(key: string): string | "unscoped" | null {
  const match = objectKeyPattern.exec(key);
  return !match ? null : match[2] ?? "unscoped";
}
