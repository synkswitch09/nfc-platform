import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ actor: vi.fn(), connection: vi.fn(), view: vi.fn(), control: vi.fn(), cycle: vi.fn(), fx: vi.fn(), settings: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/trading/auth", () => ({ tradingActor: m.actor }));
vi.mock("@/lib/trading/service", () => ({ tradingView: m.view, controlBot: m.control, runTradingCycle: m.cycle, updateFx: m.fx, updateSettings: m.settings, createReport: m.report }));
vi.mock("@/lib/trading/connectors", () => ({ checkConnection: m.connection, MarketError: class extends Error {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ allowed: true }) }));
import { GET, POST } from "@/app/api/assistants/trading/route";
import { POST as processWorker } from "@/app/api/assistants/trading/process/route";
function request(body: unknown, origin = "https://admin.example.test") {
  return new NextRequest("https://admin.example.test/api/assistants/trading", { method: "POST", headers: { host: "admin.example.test", origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv("TRADING_ENABLED", "true"); vi.stubEnv("TRADING_OWNER_USER_ID", "owner"); vi.stubEnv("TRADING_WORKER_SECRET", "worker-secret-longer-than-32-characters");
  m.actor.mockResolvedValue({ id: "owner" }); m.view.mockResolvedValue({ state: {} }); m.cycle.mockResolvedValue({ mode: "PAPER" });
});
describe("private trading HTTP boundaries", () => {
  it("hides reads and writes from unauthorized users before accessing personal data", async () => {
    m.actor.mockResolvedValue(null);
    expect((await GET()).status).toBe(404); expect((await POST(request({ action: "cycle" }))).status).toBe(404);
    expect(m.view).not.toHaveBeenCalled(); expect(m.cycle).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes and unsupported live actions", async () => {
    expect((await POST(request({ action: "cycle" }, "https://evil.test"))).status).toBe(403);
    expect((await POST(request({ action: "live-buy", symbol: "BTCUSDT" }))).status).toBe(400);
    expect(m.cycle).not.toHaveBeenCalled();
  });
  it("does not disclose environment secrets in status and keeps responses private", async () => {
    vi.stubEnv("TRADING_BINANCE_API_SECRET", "sensitive-test-secret");
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("sensitive-test-secret");
  });
  it("requires a strong bearer secret for worker access; disabled mode cannot run", async () => {
    const url = "https://admin.example.test/api/assistants/trading/process";
    expect((await processWorker(new NextRequest(url, { method: "POST" }))).status).toBe(401);
    expect(m.cycle).not.toHaveBeenCalled();
    vi.stubEnv("TRADING_ENABLED", "false");
    const response = await processWorker(new NextRequest(url, { method: "POST", headers: { authorization: "Bearer worker-secret-longer-than-32-characters" } }));
    expect(await response.json()).toEqual({ skipped: "trading-disabled" }); expect(m.cycle).not.toHaveBeenCalled();
  });
});
