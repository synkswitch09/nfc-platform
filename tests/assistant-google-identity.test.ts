import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ linked: vi.fn(), existing: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), createLink: vi.fn(), membership: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: async (fn: (tx: unknown) => unknown) => fn({
  oAuthAccount: { findUnique: m.linked, create: m.createLink }, user: { findUnique: m.existing, create: m.createUser, update: m.updateUser },
  storeMembership: { upsert: m.membership }, auditLog: { create: m.audit },
}) } }));
import { findOrCreateOAuthUser, oauthConfigWithCredentials } from "@/lib/oauth";
const config = oauthConfigWithCredentials("google", { clientId: "client", clientSecret: "secret" })!;
const claims = { sub: "google-sub", email: "admin@example.test", email_verified: true, name: "Daniel" };
const existing = { id: "existing-admin-uuid", email: claims.email, role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() };
beforeEach(() => { vi.resetAllMocks(); m.linked.mockResolvedValue(null); m.existing.mockResolvedValue(existing); m.updateUser.mockResolvedValue(existing); });
describe("Google identity linking for the assistant portal", () => {
  it("preserves an existing verified administrator ID and role without adding store access", async () => {
    expect(await findOrCreateOAuthUser(config, claims)).toEqual(existing);
    expect(m.createUser).not.toHaveBeenCalled(); expect(m.membership).not.toHaveBeenCalled();
    expect(m.createLink).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: existing.id, provider: "GOOGLE" }) });
    expect(m.updateUser.mock.calls[0][0].data).not.toHaveProperty("role");
    expect(m.audit.mock.calls[0][0].data.storeId).toBeUndefined();
  });
  it("does not link unverified or disabled accounts and requires a verified provider email", async () => {
    m.existing.mockResolvedValue({ ...existing, emailVerifiedAt: null });
    await expect(findOrCreateOAuthUser(config, claims)).rejects.toThrow("VERIFY_EXISTING_EMAIL_FIRST");
    m.existing.mockResolvedValue({ ...existing, status: "SUSPENDED" });
    await expect(findOrCreateOAuthUser(config, claims)).rejects.toThrow("ACCOUNT_DISABLED");
    await expect(findOrCreateOAuthUser(config, { ...claims, email_verified: false })).rejects.toThrow("VERIFIED_EMAIL_REQUIRED");
    expect(m.createLink).not.toHaveBeenCalled();
  });
  it("honors registration closure but permits existing accounts", async () => {
    await expect(findOrCreateOAuthUser(config, claims, undefined, { allowCreate: false })).resolves.toEqual(existing);
    m.existing.mockResolvedValue(null);
    await expect(findOrCreateOAuthUser(config, claims, undefined, { allowCreate: false })).rejects.toThrow("REGISTRATION_CLOSED");
    expect(m.createUser).not.toHaveBeenCalled();
  });
  it("new Google users are verified without admin role or store membership", async () => {
    m.existing.mockResolvedValue(null); m.createUser.mockResolvedValue({ id: "new-user", role: "CUSTOMER" });
    await findOrCreateOAuthUser(config, claims);
    expect(m.createUser.mock.calls[0][0].data).not.toHaveProperty("role");
    expect(m.createUser.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(m.membership).not.toHaveBeenCalled();
  });
  it("linked users retain identity; inactive links cannot log in; store callers retain membership behavior", async () => {
    m.linked.mockResolvedValue({ user: existing });
    expect((await findOrCreateOAuthUser(config, claims)).id).toBe(existing.id);
    expect(m.existing).not.toHaveBeenCalled(); expect(m.membership).not.toHaveBeenCalled();
    await findOrCreateOAuthUser(config, claims, "store-id"); expect(m.membership).toHaveBeenCalled();
    m.linked.mockResolvedValue({ user: { ...existing, status: "DISABLED" } });
    await expect(findOrCreateOAuthUser(config, claims)).rejects.toThrow("ACCOUNT_DISABLED");
  });
});
