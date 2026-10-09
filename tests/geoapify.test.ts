import { afterEach, expect, it, vi } from "vitest";
import { australianSuggestions, suggestAustralianAddresses } from "@/lib/geoapify";
afterEach(() => vi.unstubAllGlobals());
it("maps Australian suburbs and states and removes non-Australian results", () => {
  expect(australianSuggestions({ results: [
    { country_code: "au", formatted: "12 Test St, Norwood SA 5067", housenumber: "12", street: "Test St", suburb: "Norwood", city: "Adelaide", state: "South Australia", postcode: "5067", lat: 1, lon: 2 },
    { country_code: "nz", formatted: "An overseas address", address_line1: "1 Road" },
  ] })).toEqual([{ id: "0", label: "12 Test St, Norwood SA 5067", address: { line1: "12 Test St", locality: "Norwood", administrativeArea: "SA", postcode: "5067", country: "AU" } }]);
});
it("applies the Australia filter before sending every query and needs no second lookup", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [] })); vi.stubGlobal("fetch", fetcher);
  expect(await suggestAustralianAddresses("10 Test Street", "private-key")).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.origin).toBe("https://api.geoapify.com"); expect(url.searchParams.get("filter")).toBe("countrycode:au"); expect(url.searchParams.get("limit")).toBe("5");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" });
});
it("lets missing address fields remain editable and rejects malformed providers", () => {
  expect(australianSuggestions({ results: [{ country_code: "au", formatted: "Test Street", street: "Test Street", state_code: "AU-SA" }] })[0].address).toMatchObject({ administrativeArea: "SA", postcode: "", locality: "" });
  expect(australianSuggestions({ results: [{ country_code: "au", formatted: 123 }] })).toEqual([]);
});
