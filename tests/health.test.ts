import { describe, expect, it, vi } from "vitest";
import { livenessPayload, readinessResult } from "@/lib/health";

describe("health checks", () => {
  it("keeps liveness independent from downstream services", () => {
    expect(livenessPayload("staging")).toEqual({ status: "ok", service: "tapkin-web", environment: "staging" });
  });

  it("marks readiness available only after the database check succeeds", async () => {
    expect((await readinessResult("development", vi.fn().mockResolvedValue(1))).httpStatus).toBe(200);
    const failed = await readinessResult("production", vi.fn().mockRejectedValue(new Error("private detail")));
    expect(failed.httpStatus).toBe(503);
    expect(JSON.stringify(failed.payload)).not.toContain("private detail");
  });
});
