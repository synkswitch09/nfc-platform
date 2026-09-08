import { beforeAll, describe, expect, it } from "vitest";
import { createActivationCode, createPublicTagId, hashActivationCode, hashPassword, normaliseActivationCode, verifyActivationCode, verifyPassword } from "@/lib/crypto";
import { safeNextPath } from "@/lib/http";
import { canManageTag, hasStaffAccess, isActivatable } from "@/lib/policies";

beforeAll(() => { process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters"; process.env.ACTIVATION_PEPPER = "test-activation-pepper-with-at-least-32-characters"; });

describe("credentials", () => {
  it("hashes passwords and rejects a wrong password", async () => { const hash = await hashPassword("ExamplePassword123"); expect(hash).not.toContain("ExamplePassword123"); expect(await verifyPassword("ExamplePassword123",hash)).toBe(true); expect(await verifyPassword("wrong",hash)).toBe(false); });
  it("normalises and verifies activation codes", async () => { const hash = await hashActivationCode("ABCD-EFGH-JKLM"); expect(await verifyActivationCode("abcd-efgh-jklm",hash)).toBe(true); expect(await verifyActivationCode("ABCD-EFGH-JKL2",hash)).toBe(false); expect(normaliseActivationCode(" abcd-efgh ")).toBe("ABCD-EFGH"); });
  it("creates non-sequential public and activation identifiers", () => { const ids = new Set(Array.from({length:100},createPublicTagId)); const codes = new Set(Array.from({length:100},createActivationCode)); expect(ids.size).toBe(100); expect(codes.size).toBe(100); });
});

describe("authorisation policies", () => {
  it("only activates an unowned, unclaimed tag", () => { expect(isActivatable({status:"UNCLAIMED",ownerId:null})).toBe(true); expect(isActivatable({status:"ACTIVE",ownerId:null})).toBe(false); expect(isActivatable({status:"UNCLAIMED",ownerId:"user-2"})).toBe(false); });
  it("prevents IDOR while allowing administrators", () => { expect(canManageTag({id:"u1",role:"CUSTOMER"},{ownerId:"u2"})).toBe(false); expect(canManageTag({id:"u1",role:"CUSTOMER"},{ownerId:"u1"})).toBe(true); expect(canManageTag({id:"u1",role:"ADMIN"},{ownerId:"u2"})).toBe(true); });
  it("separates staff roles from customers", () => { expect(hasStaffAccess("CUSTOMER")).toBe(false); expect(hasStaffAccess("STAFF")).toBe(true); expect(hasStaffAccess("ADMIN")).toBe(true); });
  it("blocks open redirects", () => { expect(safeNextPath("//evil.example")).toBe("/dashboard"); expect(safeNextPath("https://evil.example")).toBe("/dashboard"); expect(safeNextPath("/shop")).toBe("/shop"); });
});
