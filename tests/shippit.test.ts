import { describe, expect, it } from "vitest";
import { parseShippitLabel, parseShippitTracking, shippitOrderPayload } from "@/lib/shippit";

describe("Shippit domestic parcels", () => {
  it("sends exactly one measured box with Shippit's metre and kilogram units", () => {
    const payload = shippitOrderPayload({ orderNumber: "TK-123", shippingName: "Jane Doe", shippingLine1: "1 Test St", shippingLine2: null, shippingSuburb: "Sydney", shippingState: "NSW", shippingPostcode: "2000", shippingPhone: null, guestEmail: "jane@example.com" }, { weightGrams: 750, lengthMm: 200, widthMm: 100, heightMm: 35 }, "TK-123-abc", "standard");
    expect(payload.order.parcel_attributes).toEqual([{ qty: 1, weight: 0.75, length: 0.2, width: 0.1, depth: 0.035 }]);
    expect(payload.order.retailer_invoice).toBe("TK-123-abc");
  });
  it("rejects a missing tracking reference and untrusted label hosts", () => {
    expect(() => parseShippitTracking({ response: {} })).toThrow();
    expect(() => parseShippitLabel({ response: { qualified_url: "https://example.com/label.pdf" } })).toThrow();
    expect(parseShippitLabel({ response: { qualified_url: "https://shippit-production.s3.amazonaws.com/label.pdf" } }).url).toContain("label.pdf");
  });
});
