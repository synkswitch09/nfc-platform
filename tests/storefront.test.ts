import { describe, expect, it } from "vitest";
import { DeploymentEnvironment, StoreCapability, StoreStatus } from "@prisma/client";
import { deploymentEnvironment, hasStoreCapability, isStoreCommerceAvailable, normaliseRequestHost, storeDomainOrigin, UnknownStorefrontError } from "@/lib/storefront";

describe("storefront routing boundaries", () => {
  it("normalises an exact request host without trusting its port", () => {
    expect(normaliseRequestHost("LOCALHOST:3000")).toBe("localhost");
    expect(normaliseRequestHost("Tapkin.com.au:443")).toBe("tapkin.com.au");
    expect(normaliseRequestHost("home.localhost:3000")).toBe("home.localhost");
  });

  it("preserves explicit development ports without adding them to production", () => {
    expect(storeDomainOrigin({ protocol: "http", hostname: "home.localhost", port: 3000 })).toBe("http://home.localhost:3000");
    expect(storeDomainOrigin({ protocol: "https", hostname: "tapkin.com.au", port: null })).toBe("https://tapkin.com.au");
  });

  it("keeps Home Demo commerce isolated without exposing NFC administration", () => {
    const homeDemo = { status: StoreStatus.ACTIVE, capabilities: [StoreCapability.COMMERCE, StoreCapability.PRINT_3D] };
    expect(isStoreCommerceAvailable(homeDemo)).toBe(true);
    expect(hasStoreCapability(homeDemo, StoreCapability.NFC)).toBe(false);
  });

  it.each([StoreStatus.DRAFT, StoreStatus.HIDDEN, StoreStatus.ARCHIVED])("blocks new commerce for a %s Store", status => {
    expect(isStoreCommerceAvailable({ status, capabilities: [StoreCapability.COMMERCE] })).toBe(false);
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
