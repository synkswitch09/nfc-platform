import { describe, expect, it } from "vitest";
import { addBusinessDays, canAcceptVariant, productionForecast } from "@/lib/production-capacity";

describe("shared production capacity", () => {
  const monday = new Date("2026-10-05T08:00:00.000Z");
  it("counts both stores in the same queue and closes at the ten-business-day limit", () => {
    expect(productionForecast(360, 360, 360, 10, monday)?.toISOString()).toBe("2026-10-19T08:00:00.000Z");
    expect(productionForecast(700, 21, 360, 10, monday)).toBeNull();
  });
  it("moves over weekends", () => {
    expect(addBusinessDays(new Date("2026-10-09T08:00:00.000Z"), 1).toISOString()).toBe("2026-10-12T08:00:00.000Z");
  });
  it("keeps ready stock available while made-to-order capacity is paused", () => {
    const variant = { trackInventory: true, backorderPolicy: "ALLOW", inventory: 2, reservedInventory: 1, productionMinutes: 60 };
    const pool = { paused: true, weeklyCapacityMinutes: 360, maxBusinessDays: 10 };
    expect(canAcceptVariant(variant, pool, 720)).toBe(true);
    expect(canAcceptVariant({ ...variant, reservedInventory: 2 }, pool, 720)).toBe(false);
  });
});
