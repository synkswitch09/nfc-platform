import type { Prisma } from "@prisma/client";

type ClearResult<T> = { value: T; changed: boolean };

/** Replaces an exact uploaded-media URL in a JSON value with an empty value. */
export function clearMediaReference<T>(value: T, url: string): ClearResult<T> {
  if (value === url) return { value: "" as T, changed: true };
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = clearMediaReference(item, url);
      changed ||= result.changed;
      return result.value;
    });
    return { value: (changed ? next : value) as T, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const result = clearMediaReference(item, url);
      changed ||= result.changed;
      next[key] = result.value;
    }
    return { value: (changed ? next : value) as T, changed };
  }
  return { value, changed: false };
}

export function clearMediaJsonReference(
  value: Prisma.JsonValue,
  url: string,
): ClearResult<Prisma.JsonValue> {
  return clearMediaReference(value, url);
}
