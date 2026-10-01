import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("production storefront preview", () => {
  it("rejects order and account mutations while leaving public pages viewable and unindexed", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PRODUCTION_PREVIEW_MODE", "true");
    for (const path of ["/api/checkout", "/api/auth/register", "/api/stripe/webhook"]) {
      const response = await proxy(new NextRequest(`https://tapkin.com.au${path}`, { method: "POST" }));
      expect(response.status).toBe(503);
      expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    }
    const home = await proxy(new NextRequest("https://kosykin.com.au/"));
    expect(home.status).toBe(200);
    expect(home.headers.get("X-Robots-Tag")).toContain("noindex");
    expect((await proxy(new NextRequest("https://kosykin.com.au/api/admin/orders"))).status).toBe(503);
    expect((await proxy(new NextRequest("https://kosykin.com.au/api/health/ready"))).status).toBe(200);
  });
  it("allows official production pages and admin writes with checkout closed", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PRODUCTION_PREVIEW_MODE", "false");
    vi.stubEnv("PRODUCTION_CHECKOUT_ENABLED", "false");
    const home = await proxy(new NextRequest("https://tapkin.com.au/"));
    expect(home.status).toBe(200);
    expect(home.headers.get("X-Robots-Tag")).toBeNull();
    expect((await proxy(new NextRequest("https://tapkin.com.au/api/auth/register", { method: "POST" }))).status).toBe(200);
  });
});
