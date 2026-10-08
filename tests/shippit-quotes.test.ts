import { beforeEach, describe, expect, it, vi } from "vitest";
import { quoteShippitParcels } from "@/lib/shippit-quotes";
import { shippitRequest } from "@/lib/shippit";

vi.mock("@/lib/shippit", () => ({ shippitRequest: vi.fn() }));

const request = vi.mocked(shippitRequest);
const destination = { line1: "1 Test Street", locality: "Adelaide", administrativeArea: "SA", postcode: "5000", country: "AU" };

describe("Shippit checkout quotes", () => {
  beforeEach(() => request.mockReset());

  it("sends each physical parcel inside Shippit's required quote object and sums prices", async () => {
    request.mockResolvedValue({ response: [
      { success: true, service_level: "standard", quotes: [{ price: 8.5 }] },
      { success: true, service_level: "express", quotes: [{ price: 13 }] },
    ] });
    const rates = await quoteShippitParcels(destination, [{ quantity: 2, weightGrams: 250, lengthMm: 250, widthMm: 150, heightMm: 30 }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith("/quotes", {
      method: "POST",
      body: JSON.stringify({ quote: {
        dropoff_postcode: "5000", dropoff_suburb: "Adelaide", dropoff_state: "SA", dropoff_country_code: "AU",
        service_levels: ["standard", "express"],
        parcel_attributes: [{ qty: 1, weight: 0.25, length: 0.25, width: 0.15, depth: 0.03 }],
      } }),
    });
    expect(rates.map(rate => [rate.serviceName, rate.amountCents])).toEqual([["Shippit Standard", 1700], ["Shippit Express", 2600]]);
  });
});
