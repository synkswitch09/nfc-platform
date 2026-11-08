import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/lib/assistants/auth", () => ({ assistantUser: m.user, createAssistantSession: vi.fn(), destroyAssistantSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/assistants/email", () => ({ assistantAuthEmail: vi.fn() }));
import { GET } from "@/app/api/assistants/auth/route";
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv("ANTHROPIC_API_KEY", "never-return-this-secret");
  vi.stubEnv("AI_ASSISTANT_MODELS", JSON.stringify([{ key: "test-model", provider: "anthropic", modelId: "deployed-model-id", name: "Configured model", description: "", enabled: true, maxOutputTokens: 512 }]));
});
describe("private account identifiers", () => {
  it("requires a verified session", async () => {
    m.user.mockResolvedValue(null); expect((await GET()).status).toBe(401);
    m.user.mockResolvedValue({ id: "user", emailVerifiedAt: null }); expect((await GET()).status).toBe(401);
  });
  it("returns only the current user's identity and effective model IDs for admins", async () => {
    m.user.mockResolvedValue({ id: "actual-user-id", email: "admin@example.test", name: "Daniel", role: "ADMIN", emailVerifiedAt: new Date() });
    const response = await GET(); const text = await response.text();
    expect(text).not.toContain("never-return-this-secret");
    expect(JSON.parse(text)).toMatchObject({ user: { id: "actual-user-id", email: "admin@example.test" }, models: [{ modelId: "deployed-model-id" }], anthropicConfigured: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("never exposes model configuration to customers", async () => {
    m.user.mockResolvedValue({ id: "customer", email: "customer@example.test", role: "CUSTOMER", emailVerifiedAt: new Date() });
    const response = await GET(); const body = await response.json();
    expect(body.user.id).toBe("customer"); expect(body).not.toHaveProperty("models"); expect(body).not.toHaveProperty("anthropicConfigured");
  });
});
