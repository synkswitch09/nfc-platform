import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ product: vi.fn(), category: vi.fn(), pet: vi.fn(), user: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { productImage: { findFirst: m.product }, categoryImage: { findFirst: m.category }, petProfile: { findFirst: m.pet } } }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: async () => ({ id: "store" }) }));
vi.mock("@/lib/uploads", () => ({ readStoredImage: m.read }));
import { GET } from "@/app/api/media/[storageKey]/route";
import { petPhotoUrl } from "@/lib/pet-photo-url";
const key = "development-tapkin-11111111-1111-1111-1111-111111111111.png";
const run = () => GET(new Request(`https://test.example/api/media/${key}`), { params: Promise.resolve({ storageKey: key }) });
beforeEach(() => { vi.resetAllMocks(); m.read.mockResolvedValue(new Uint8Array([1, 2])); });
it.each(["ACTIVE", "LOST"])("serves %s public pet photos without shared caching", async status => {
  m.pet.mockResolvedValue({ tagProfile: { isPublic: true, tag: { status, ownerId: "owner" } } });
  const response = await run();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
});
it.each(["MANUFACTURED", "UNCLAIMED", "DISABLED", "REPLACED"])("denies %s photos by the old direct URL", async status => {
  m.pet.mockResolvedValue({ tagProfile: { isPublic: true, tag: { status, ownerId: "owner" } } });
  expect((await run()).status).toBe(404);
  expect(m.read).not.toHaveBeenCalled();
});
it.each([null, { id: "another-customer" }])("denies a private profile to visitor %j", async user => {
  m.user.mockResolvedValue(user);
  m.pet.mockResolvedValue({ tagProfile: { isPublic: false, tag: { status: "ACTIVE", ownerId: "owner" } } });
  const response = await run();
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(m.read).not.toHaveBeenCalled();
});
it("lets the authenticated owner preview their disabled private profile", async () => {
  m.user.mockResolvedValue({ id: "owner" });
  m.pet.mockResolvedValue({ tagProfile: { isPublic: false, tag: { status: "DISABLED", ownerId: "owner" } } });
  expect((await run()).status).toBe(200);
});
it("scopes every lookup to this storefront and denies absent/other-store references", async () => {
  expect((await run()).status).toBe(404);
  expect(m.pet.mock.calls[0][0].where.tagProfile.tag.storeId).toBe("store");
  expect(m.product.mock.calls[0][0].where.product.storeId).toBe("store");
  expect(m.category.mock.calls[0][0].where.storeId).toBe("store");
  expect(m.read).not.toHaveBeenCalled();
});
it("keeps commercial images public", async () => {
  m.product.mockResolvedValue({ mimeType: "image/png" });
  const response = await run();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("public");
  expect(m.user).not.toHaveBeenCalled();
});
it("does not let a commercial reference bypass a pet restriction", async () => {
  m.product.mockResolvedValue({ mimeType: "image/png" });
  m.pet.mockResolvedValue({ tagProfile: { isPublic: false, tag: { status: "ACTIVE", ownerId: "owner" } } });
  expect((await run()).status).toBe(404);
});
it("uses a new browser cache key and does not expose external legacy photos", () => {
  expect(petPhotoUrl(`/api/media/${key}`)).toBe(`/api/media/${key}?privacy=1`);
  expect(petPhotoUrl("https://external.example/pet.png")).toBe("");
});
