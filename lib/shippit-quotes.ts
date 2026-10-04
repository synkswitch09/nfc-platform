import type { PackedParcel, ShippingDestination } from "@/lib/shipping";
import type { ProviderRate } from "@/lib/shipping-providers";
import { shippitRequest } from "@/lib/shippit";

type Quote = { success?: boolean; service_level?: string; quotes?: Array<{ price?: number }> };

export async function quoteShippitParcels(destination: ShippingDestination, parcels: PackedParcel[]): Promise<ProviderRate[]> {
  if (destination.country !== "AU" || !parcels.length) return [];
  // Fulfilment creates one Shippit order per physical parcel. Quote in the
  // same units so consolidation rules cannot understate the checkout total.
  const prices = new Map<string, number>();
  let count = 0;
  for (const parcel of parcels) {
    for (let i = 0; i < parcel.quantity; i++) {
      if (++count > 30) return [];
      const body = await shippitRequest("/quotes", { method: "POST", body: JSON.stringify({
        dropoff_postcode: destination.postcode,
        dropoff_suburb: destination.locality,
        dropoff_state: destination.administrativeArea,
        dropoff_country_code: "AU",
        service_levels: ["standard", "express"],
        parcel_attributes: [{ qty: 1, weight: parcel.weightGrams / 1000, length: parcel.lengthMm / 1000, width: parcel.widthMm / 1000, depth: parcel.heightMm / 1000 }],
      }) });
      const options = Array.isArray(body?.response) ? body.response as Quote[] : [];
      const current = new Map<string, number>();
      for (const option of options) {
        const level = option.service_level?.toLowerCase();
        if (!option.success || (level !== "standard" && level !== "express")) continue;
        const valid = option.quotes?.map(quote => quote.price).filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0) ?? [];
        if (valid.length) current.set(level, Math.min(current.get(level) ?? Infinity, ...valid));
      }
      if (!current.size) return [];
      if (count === 1) for (const [level, price] of current) prices.set(level, price);
      else for (const [level, subtotal] of prices) {
        if (!current.has(level)) prices.delete(level);
        else prices.set(level, subtotal + current.get(level)!);
      }
    }
  }
  return [...prices].map(([level, price]) => ({ providerKey: "shippit", serviceCode: level, serviceName: `Shippit ${level === "express" ? "Express" : "Standard"}`, amountCents: Math.round(price * 100), estimatedDaysMin: null, estimatedDaysMax: null }));
}
