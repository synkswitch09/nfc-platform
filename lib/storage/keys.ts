import type { AppEnvironment } from "@/lib/config";

const objectKeyPattern = /^(?:(development|staging|production)-)?[0-9a-f-]{36}\.(png|jpg|webp)$/;

export function createStorageKey(environment: AppEnvironment, id: string, extension: "png" | "jpg" | "webp") {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("INVALID_STORAGE_ID");
  return `${environment}-${id}.${extension}`;
}

export function isSafeStorageKey(key: string) { return objectKeyPattern.test(key); }

export function storageKeyEnvironment(key: string): AppEnvironment | "legacy" | null {
  const match = objectKeyPattern.exec(key);
  return !match ? null : match[1] as AppEnvironment | undefined ?? "legacy";
}
