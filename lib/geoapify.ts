import { z } from "zod";

const states: Record<string, string> = { "Australian Capital Territory": "ACT", "New South Wales": "NSW", "Northern Territory": "NT", Queensland: "QLD", "South Australia": "SA", Tasmania: "TAS", Victoria: "VIC", "Western Australia": "WA" };
const resultSchema = z.object({
  country_code: z.string(), formatted: z.string().max(1000), place_id: z.string().max(500).optional(),
  address_line1: z.string().max(160).optional(), housenumber: z.string().max(40).optional(), street: z.string().max(120).optional(),
  suburb: z.string().max(100).optional(), city: z.string().max(100).optional(), town: z.string().max(100).optional(), village: z.string().max(100).optional(),
  state: z.string().max(100).optional(), state_code: z.string().max(20).optional(), postcode: z.string().max(20).optional(),
});
export type AustralianAddressSuggestion = { id: string; label: string; address: { line1: string; locality: string; administrativeArea: string; postcode: string; country: "AU" } };
export class GeoapifyError extends Error {
  constructor(public readonly kind: "timeout" | "http" | "network" | "invalid_response", public readonly status: number | null, public readonly elapsedMs: number) {
    super("Address suggestions unavailable");
    this.name = "GeoapifyError";
  }
}

export function australianSuggestions(payload: unknown): AustralianAddressSuggestion[] {
  const results = z.object({ results: z.array(z.unknown()).max(20) }).safeParse(payload);
  if (!results.success) return [];
  return results.data.results.flatMap((raw, index) => {
    const parsed = resultSchema.safeParse(raw);
    if (!parsed.success || parsed.data.country_code.toLowerCase() !== "au") return [];
    const value = parsed.data;
    const state = value.state_code?.replace(/^AU-/, "").toUpperCase() || states[value.state ?? ""] || "";
    const line1 = value.street ? [value.housenumber, value.street].filter(Boolean).join(" ") : value.address_line1 ?? "";
    if (!line1) return [];
    return [{ id: value.place_id ?? String(index), label: value.formatted, address: { line1, locality: value.suburb || value.city || value.town || value.village || "", administrativeArea: Object.values(states).includes(state) ? state : "", postcode: /^\d{4}$/.test(value.postcode ?? "") ? value.postcode! : "", country: "AU" as const } }];
  }).slice(0, 5);
}

export async function suggestAustralianAddresses(text: string, apiKey: string) {
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.search = new URLSearchParams({ text, apiKey, filter: "countrycode:au", format: "json", lang: "en", limit: "5" }).toString();
  const started = Date.now();
  const signal = AbortSignal.timeout(8000);
  let receivedResponse = false;
  try {
    const response = await fetch(url, { cache: "no-store", signal, headers: { Accept: "application/json" }, redirect: "error" });
    receivedResponse = true;
    if (!response.ok) throw new GeoapifyError("http", response.status, Date.now() - started);
    const payload = await response.json();
    if (!z.object({ results: z.array(z.unknown()).max(20) }).safeParse(payload).success) throw new GeoapifyError("invalid_response", null, Date.now() - started);
    return australianSuggestions(payload);
  } catch (error) {
    if (error instanceof GeoapifyError) throw error;
    const timedOut = signal.aborted || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name));
    throw new GeoapifyError(timedOut ? "timeout" : receivedResponse ? "invalid_response" : "network", null, Date.now() - started);
  }
}
