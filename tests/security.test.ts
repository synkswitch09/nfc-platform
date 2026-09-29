import { beforeAll, describe, expect, it } from "vitest";
import { createActivationCode, createPublicTagId, hashActivationCode, hashPassword, normaliseActivationCode, verifyActivationCode, verifyPassword } from "@/lib/crypto";
import { NextRequest } from "next/server";
import { getClientIp, safeNextPath } from "@/lib/http";
import { canManageTag, hasStaffAccess, isActivatable } from "@/lib/policies";
import { isManagedProfileType } from "@/lib/product-types";

beforeAll(() => { process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters"; process.env.ACTIVATION_PEPPER = "test-activation-pepper-with-at-least-32-characters"; });

describe("credentials", () => {
  it("hashes passwords and rejects a wrong password", async () => { const hash = await hashPassword("ExamplePassword123"); expect(hash).not.toContain("ExamplePassword123"); expect(await verifyPassword("ExamplePassword123",hash)).toBe(true); expect(await verifyPassword("wrong",hash)).toBe(false); });
  it("normalises and verifies activation codes", async () => { const hash = await hashActivationCode("ABCD-EFGH-JKLM"); expect(await verifyActivationCode("abcd-efgh-jklm",hash)).toBe(true); expect(await verifyActivationCode("ABCD-EFGH-JKL2",hash)).toBe(false); expect(normaliseActivationCode(" abcd-efgh ")).toBe("ABCD-EFGH"); });
  it("creates high-entropy, non-sequential public and activation identifiers", () => { const ids = new Set(Array.from({length:100},createPublicTagId)); const codes = new Set(Array.from({length:100},createActivationCode)); expect(ids.size).toBe(100); expect(codes.size).toBe(100); expect([...ids].every(id => id.length === 16)).toBe(true); });
});

describe("authorisation policies", () => {
  it("only activates an unowned, unclaimed tag", () => { expect(isActivatable({status:"UNCLAIMED",ownerId:null})).toBe(true); expect(isActivatable({status:"ACTIVE",ownerId:null})).toBe(false); expect(isActivatable({status:"UNCLAIMED",ownerId:"user-2"})).toBe(false); });
  it("prevents IDOR while allowing administrators", () => { expect(canManageTag({id:"u1",role:"CUSTOMER"},{ownerId:"u2"})).toBe(false); expect(canManageTag({id:"u1",role:"CUSTOMER"},{ownerId:"u1"})).toBe(true); expect(canManageTag({id:"u1",role:"ADMIN"},{ownerId:"u2"})).toBe(true); });
  it("separates staff roles from customers", () => { expect(hasStaffAccess("CUSTOMER")).toBe(false); expect(hasStaffAccess("STAFF")).toBe(true); expect(hasStaffAccess("ADMIN")).toBe(true); });
  it("activates every NFC profile type but not catalogue-only accessories", () => { expect(isManagedProfileType("PET")).toBe(true); expect(isManagedProfileType("EMERGENCY")).toBe(true); expect(isManagedProfileType("REVIEW")).toBe(true); expect(isManagedProfileType("CUSTOM")).toBe(true); expect(isManagedProfileType("ACCESSORY")).toBe(false); });
  it("blocks open redirects", () => { expect(safeNextPath("//evil.example")).toBe("/dashboard"); expect(safeNextPath("https://evil.example")).toBe("/dashboard"); expect(safeNextPath("/shop")).toBe("/shop"); });
  it("trusts forwarded client addresses only behind an explicitly trusted proxy", () => {
    const request = new NextRequest("http://localhost", { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.2" } });
    process.env.TRUST_PROXY = "false";
    expect(getClientIp(request)).toBe("untrusted-proxy");
    process.env.TRUST_PROXY = "true";
    expect(getClientIp(request)).toBe("203.0.113.10");
    delete process.env.TRUST_PROXY;
  });
});
