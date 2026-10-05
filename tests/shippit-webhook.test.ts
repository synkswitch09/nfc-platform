import { describe, expect, it } from "vitest";
import { parseShippitWebhook, shippitOrderProgress, validShippitWebhookToken } from "@/lib/shippit-webhook";

describe("Shippit mapped tracking events", () => {
  it("accepts only the configured secret and reads the event's actual time", () => {
    const secret = "a-random-secret-with-at-least-32-characters";
    expect(validShippitWebhookToken(secret, secret)).toBe(true);
    expect(validShippitWebhookToken("invalid", secret)).toBe(false);
    expect(validShippitWebhookToken(null, secret)).toBe(false);
    expect(validShippitWebhookToken(secret, undefined)).toBe(false);
    const event = parseShippitWebhook({ tracking_number: "PPYvZCTod5bkD", current_state: "completed", status_history: [{ status: "completed", time: "2026-10-05T00:00:00Z" }, { status: "in_transit", time: "2026-10-04T00:00:00Z" }] });
    expect(event.eventAt.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(event.state).toBe("completed");
  });

  it("requires every booked box before shipping and every delivered box before completing", () => {
    const booked = { bookedAt: new Date(), trackingNumber: "TRACK-123", status: "IN_TRANSIT" };
    const pending = { bookedAt: null, trackingNumber: "TRACK-456", status: "LABEL_READY" };
    expect(shippitOrderProgress("READY_TO_SHIP", "in_transit", [booked, pending]).ship).toBe(false);
    expect(shippitOrderProgress("READY_TO_SHIP", "in_transit", [booked, { ...pending, bookedAt: new Date() }]).ship).toBe(true);
    expect(shippitOrderProgress("SHIPPED", "completed", [{ ...booked, status: "DELIVERED" }, booked]).deliver).toBe(false);
    expect(shippitOrderProgress("SHIPPED", "completed", [{ ...booked, status: "DELIVERED" }, { ...pending, status: "DELIVERED" }]).deliver).toBe(true);
    expect(shippitOrderProgress("READY_TO_SHIP", "order_placed", [booked]).ship).toBe(false);
  });
});
