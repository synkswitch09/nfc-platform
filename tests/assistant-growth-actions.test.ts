import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  workspace: vi.fn(),
  update: vi.fn(),
  find: vi.fn(),
  list: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/db", () => {
  const client = {
    assistantWorkspace: { findUnique: mocks.workspace, update: mocks.update },
    assistantResource: {
      findFirst: mocks.find,
      findMany: mocks.list,
      count: mocks.count,
      create: mocks.create,
      update: mocks.update,
    },
    $queryRaw: mocks.query,
  };
  return {
    db: {
      ...client,
      $transaction: (fn: (tx: unknown) => unknown) => fn(client),
    },
  };
});
vi.mock("@/lib/assistants/auth", () => ({ assistantUser: mocks.user }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.limit }));
import { GET, POST } from "@/app/api/assistants/workspaces/[id]/growth/route";
const id = "916cad1a-07b8-4fa8-9315-7c1ef1fd88ae",
  recordId = "716cad1a-07b8-4fa8-9315-7c1ef1fd88ae";
const context = { params: Promise.resolve({ id }) };
function call(body: unknown, origin = "https://admin.tapkin.com.au") {
  return POST(
    new NextRequest(
      `https://admin.tapkin.com.au/api/assistants/workspaces/${id}/growth`,
      {
        method: "POST",
        headers: {
          host: "admin.tapkin.com.au",
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    ),
    context,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_ASSISTANTS_ORIGIN", "https://admin.tapkin.com.au");
  mocks.user.mockResolvedValue({
    id: "owner",
    role: "USER",
    emailVerifiedAt: new Date(),
  });
  mocks.workspace.mockResolvedValue({ id, ownerId: "owner" });
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.count.mockResolvedValue(0);
  mocks.list.mockResolvedValue([]);
});
it("rejects foreign origins before database access", async () => {
  expect(
    (await call({ action: "locale" }, "https://evil.example")).status,
  ).toBe(403);
  expect(mocks.workspace).not.toHaveBeenCalled();
});
it("rejects another owner's business before resource reads", async () => {
  mocks.workspace.mockResolvedValue({ id, ownerId: "someone-else" });
  expect(
    (
      await GET(
        new NextRequest(
          `https://admin.tapkin.com.au/api/assistants/workspaces/${id}/growth`,
        ),
        context,
      )
    ).status,
  ).toBe(404);
  expect(mocks.list).not.toHaveBeenCalled();
});
it("scopes every list query to the authenticated business", async () => {
  const response = await GET(
    new NextRequest(
      `https://admin.tapkin.com.au/api/assistants/workspaces/${id}/growth?kind=CONTACT`,
    ),
    context,
  );
  expect(response.status).toBe(200);
  expect(mocks.list.mock.calls[0][0].where).toEqual({
    workspaceId: id,
    kind: "CONTACT",
  });
  expect(mocks.list.mock.calls[0][0].take).toBe(101);
});
it("rate limits before writes", async () => {
  mocks.limit.mockResolvedValue({ allowed: false });
  expect((await call({ action: "locale" })).status).toBe(429);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects extra privileges in locale settings", async () => {
  expect(
    (
      await call({
        action: "locale",
        preferredLanguage: "en-AU",
        preferredCountry: "AU",
        timeZone: "Australia/Adelaide",
        billingExempt: true,
      })
    ).status,
  ).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("blocks a stale record without overwriting it", async () => {
  mocks.find.mockResolvedValue(null);
  expect(
    (
      await call({
        action: "save",
        id: recordId,
        version: 1,
        kind: "CONTACT",
        title: "Customer",
        data: { name: "Customer" },
      })
    ).status,
  ).toBe(409);
  expect(mocks.find.mock.calls[0][0].where).toMatchObject({
    id: recordId,
    workspaceId: id,
    version: 1,
  });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("prevents editing an approved version", async () => {
  mocks.find.mockResolvedValue({ id: recordId, status: "APPROVED" });
  expect(
    (
      await call({
        action: "save",
        id: recordId,
        version: 1,
        kind: "CAMPAIGN",
        title: "Campaign",
        data: { objective: "More enquiries" },
      })
    ).status,
  ).toBe(409);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects cross-business campaign recipients", async () => {
  expect(
    (
      await call({
        action: "save",
        kind: "CAMPAIGN",
        title: "Campaign",
        data: { objective: "More enquiries", contactIds: [recordId] },
      })
    ).status,
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("reserves no more than 500 records per section", async () => {
  mocks.count.mockResolvedValue(500);
  expect(
    (
      await call({
        action: "save",
        kind: "CONTACT",
        title: "Customer",
        data: { name: "Customer" },
      })
    ).status,
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
