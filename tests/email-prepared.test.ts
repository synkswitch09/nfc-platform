import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultEmailTemplate } from "@/lib/email-templates";
const m = vi.hoisted(() => ({ store: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { store: { findUnique: m.store } } }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: () => ({ appEnv: "production", email: { mode: "live", provider: "resend", webhookUrl: "https://api.resend.com/emails", resendStores: { kosykin: { apiKey: "test-only" } } } }) }));
import { sendTransactionalEmail } from "@/lib/email";
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", m.fetch);
  m.fetch.mockResolvedValue(new Response('{}', { status: 200 }));
  m.store.mockResolvedValue({ displayName: "Kosykin", accountConfig: {}, domains: [{ environment: "PRODUCTION", isPrimary: true, protocol: "https", hostname: "kosykin.com.au" }] });
});
afterEach(() => vi.unstubAllGlobals());
it("uses only the published template for this store, not its draft", async () => {
  const custom = { ...defaultEmailTemplate("payment"), subject: "Published {{order.number}}", blocks: [{ type: "text" as const, text: "Hello {{customer.name}}" }] };
  m.store.mockResolvedValue({ displayName: "Kosykin", domains: [{ environment: "PRODUCTION", isPrimary: true, protocol: "https", hostname: "kosykin.com.au" }], accountConfig: { emailTemplates: { payment: { draft: { ...custom, subject: "Draft only" }, published: custom, revision: 2, updatedAt: "2026-10-10", publishedAt: "2026-10-10" } } } });
  await sendTransactionalEmail({ storeSlug: "kosykin", to: "customer@example.test", subject: "Paid", text: "Payment confirmed", templateKey: "payment", templateFields: { "order.number": "K1" }, customerName: "Alex" });
  const payload = JSON.parse(m.fetch.mock.calls[0][1].body);
  expect(payload.subject).toBe("Published K1"); expect(payload.html).toContain("Hello Alex"); expect(payload.text).toContain("Payment confirmed"); expect(payload.html).not.toContain("Draft only");
});
it("persists the prepared body before sending, and reuses it when templates or senders change", async () => {
  const capture = vi.fn(async (_message: import("@/lib/email-templates").PreparedEmail) => { expect(m.fetch).not.toHaveBeenCalled(); });
  const input = { storeSlug: "kosykin", to: "customer@example.test", subject: "Paid", text: "Payment confirmed", idempotencyKey: "notice-1" };
  await sendTransactionalEmail({ ...input, onPrepared: capture });
  const body = m.fetch.mock.calls[0][1].body;
  const prepared = capture.mock.calls[0][0];
  m.store.mockResolvedValue({ displayName: "Different display name", accountConfig: {}, domains: [{ environment: "PRODUCTION", isPrimary: true, protocol: "https", hostname: "kosykin.com.au" }] });
  await sendTransactionalEmail({ ...input, prepared, onPrepared: capture });
  expect(m.fetch.mock.calls[1][1].body).toBe(body); expect(capture).toHaveBeenCalledTimes(1);
});
it("does not contact the provider when the durable snapshot cannot be saved", async () => {
  await expect(sendTransactionalEmail({ storeSlug: "kosykin", to: "customer@example.test", subject: "Paid", text: "Payment", onPrepared: async () => { throw new Error("Lease lost"); } })).rejects.toThrow("Lease lost");
  expect(m.fetch).not.toHaveBeenCalled();
});
