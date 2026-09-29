export function scopeToStore<T extends Record<string, unknown>>(storeId: string, where: T): Omit<T, "storeId"> & { storeId: string } {
  return { ...where, storeId };
}

export function belongsToStore(resourceStoreId: string, trustedStoreId: string) {
  return resourceStoreId === trustedStoreId;
}

export function storeCanonicalUrl(origin: string, path = "/") {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("INVALID_STORE_PATH");
  return new URL(path, `${origin.replace(/\/$/, "")}/`).toString();
}
