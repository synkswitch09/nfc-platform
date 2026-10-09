import { z } from "zod";
import { countryAddressSchema } from "@/lib/address-validation";

const detailsSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), address: countryAddressSchema });
export type CheckoutDetails = z.infer<typeof detailsSchema>;
type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const checkoutMemoryKey = (store: string) => `checkout-details:v1:${store}`;
const day = 86_400_000;

export function forgetCheckout(storage: StorageAccess, store: string) {
  try { storage.removeItem(checkoutMemoryKey(store)); } catch { /* Storage can be disabled by the browser. */ }
}

export function loadCheckout(storage: StorageAccess, store: string, days: number, now = Date.now()): CheckoutDetails | null {
  try {
    const value = JSON.parse(storage.getItem(checkoutMemoryKey(store)) ?? "null");
    if (!value || value.version !== 1 || value.store !== store || !Number.isFinite(value.savedAt) || !Number.isFinite(value.expiresAt) || value.savedAt > now || value.expiresAt <= now || value.expiresAt > value.savedAt + 90 * day || now - value.savedAt >= Math.min(days, 90) * day) throw new Error("Expired or invalid");
    const parsed = detailsSchema.parse(value.details);
    if (parsed.address.country !== "AU") throw new Error("Unsupported country");
    return parsed;
  } catch { forgetCheckout(storage, store); return null; }
}

export function saveCheckout(storage: StorageAccess, store: string, details: CheckoutDetails, days: number, now = Date.now()): boolean {
  const parsed = detailsSchema.safeParse(details);
  if (!parsed.success || parsed.data.address.country !== "AU" || !Number.isInteger(days) || days < 1 || days > 90) return false;
  try {
    // The schema allowlists contact/address fields; payment and authentication data cannot be saved.
    storage.setItem(checkoutMemoryKey(store), JSON.stringify({ version: 1, store, savedAt: now, expiresAt: now + days * day, details: parsed.data }));
    return true;
  } catch { return false; }
}
