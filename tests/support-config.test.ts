import { describe, expect, it } from "vitest";
import { canPauseBeforePreparation, parseSupportConfig, responseDeadline, supportConfigSchema } from "@/lib/support-config";
describe("support policies", () => {
  it("defaults to verified guest access, five business days and automatic pause", () => {
    expect(parseSupportConfig({})).toMatchObject({ guestEnabled: true, firstResponseBusinessDays: 5, autoPause: true, notificationEmails: [] });
  });
  it("validates holiday dates, target bounds and internal recipient addresses", () => {
    expect(supportConfigSchema.safeParse({ holidays: ["2026-02-30"] }).success).toBe(false);
    expect(supportConfigSchema.safeParse({ firstResponseBusinessDays: 0 }).success).toBe(false);
    expect(supportConfigSchema.safeParse({ notificationEmails: ["not an email"] }).success).toBe(false);
    expect(supportConfigSchema.safeParse({ notificationEmails: Array(6).fill("a@example.test") }).success).toBe(false);
  });
  it("counts five business days from Friday, excludes a holiday and ends at local 5 pm", () => {
    expect(responseDeadline(new Date("2026-10-09T04:00:00Z"), 5, "Australia/Adelaide").toISOString()).toBe("2026-10-16T06:30:00.000Z");
    expect(responseDeadline(new Date("2026-10-09T04:00:00Z"), 5, "Australia/Adelaide", ["2026-10-12"]).toISOString()).toBe("2026-10-19T06:30:00.000Z");
  });
  it("uses the store's local calendar and daylight saving offset", () => {
    expect(responseDeadline(new Date("2026-10-04T14:00:00Z"), 1, "Australia/Adelaide").toISOString()).toBe("2026-10-06T06:30:00.000Z");
    expect(responseDeadline(new Date("2026-10-01T04:00:00Z"), 2, "Australia/Adelaide").toISOString()).toBe("2026-10-05T06:30:00.000Z");
  });
  it("pauses unstarted made-to-order and stock purchases, never work already started", () => {
    const base = { status: "PAID", preparationStartedAt: null, items: [{ packedQuantity: 0, manufacturingJobs: [{ status: "QUEUED", startedAt: null }] }] };
    expect(canPauseBeforePreparation(base)).toBe(true);
    expect(canPauseBeforePreparation({ ...base, items: [{ packedQuantity: 0, manufacturingJobs: [] }] })).toBe(true);
    expect(canPauseBeforePreparation({ ...base, status: "PROCESSING" })).toBe(false);
    expect(canPauseBeforePreparation({ ...base, preparationStartedAt: new Date() })).toBe(false);
    expect(canPauseBeforePreparation({ ...base, items: [{ packedQuantity: 1, manufacturingJobs: [] }] })).toBe(false);
    expect(canPauseBeforePreparation({ ...base, items: [{ packedQuantity: 0, manufacturingJobs: [{ status: "PRINTING", startedAt: new Date() }] }] })).toBe(false);
  });
});
