import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn().mockResolvedValue({ id: "existing-tapkin" }),
  upsert: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return { ...actual, PrismaClient: class {
    store = { findUnique: mocks.findUnique, upsert: mocks.upsert };
    $disconnect = mocks.disconnect;
  } };
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("re-running the seed on an existing store exits before any catalog or account mutation", async () => {
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("STAGING_ADMIN_EMAIL", "");
  vi.stubEnv("STAGING_ADMIN_PASSWORD", "");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../prisma/seed");
  await vi.waitFor(() => expect(mocks.disconnect).toHaveBeenCalled());
  expect(mocks.findUnique).toHaveBeenCalledWith({ where: { slug: "tapkin" }, select: { id: true } });
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith(expect.stringContaining("seed skipped"));
});
