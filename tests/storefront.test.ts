import { describe, expect, it } from "vitest";
import { DeploymentEnvironment, StoreCapability } from "@prisma/client";
import { deploymentEnvironment, hasStoreCapability, normaliseRequestHost, UnknownStorefrontError } from "@/lib/storefront";

describe("storefront routing boundaries", () => {
  it("normalises an exact request host without trusting its port", () => {
    expect(normaliseRequestHost("LOCALHOST:3000")).toBe("localhost");
    expect(normaliseRequestHost("Tapkin.com.au:443")).toBe("tapkin.com.au");
  });

  it.each(["tapkin.com.au/evil", "tapkin.com.au@evil.example", "tapkin.com.au,evil.example", "", "tapkin.com.au\\evil"])("rejects an unsafe host value: %s", value => {
    expect(() => normaliseRequestHost(value)).toThrow(UnknownStorefrontError);
  });

  it("keeps deployment environment separate from Store identity", () => {
    expect(deploymentEnvironment("development")).toBe(DeploymentEnvironment.DEVELOPMENT);
    expect(deploymentEnvironment("staging")).toBe(DeploymentEnvironment.STAGING);
    expect(deploymentEnvironment("production")).toBe(DeploymentEnvironment.PRODUCTION);
  });

  it("checks optional modules from server-owned Store configuration", () => {
    expect(hasStoreCapability({ capabilities: [StoreCapability.COMMERCE] }, StoreCapability.COMMERCE)).toBe(true);
    expect(hasStoreCapability({ capabilities: [StoreCapability.COMMERCE] }, StoreCapability.NFC)).toBe(false);
  });
});
