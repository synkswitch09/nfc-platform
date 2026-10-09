import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ update: vi.fn(), rows: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { supportNotification: { updateMany: m.update, findMany: m.rows } } }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail: m.send }));
import { processSupportNotifications } from "@/lib/support-notifications";
const snapshot = { subject: "Reviewed support design", text: "Mandatory facts", html: "<p>Reviewed</p>", sender: { address: "support@kosykin.com.au", name: "Kosykin", from: "Kosykin <support@kosykin.com.au>" } };
const row = { id: "n", ticketId: "t", to: "customer@example.test", subject: "Support", text: "Facts", attempts: 0, emailSnapshot: null, ticket: { customerName: "Alex", order: null, store: { slug: "kosykin" } } };
beforeEach(() => { vi.resetAllMocks(); m.update.mockResolvedValue({ count: 1 }); m.rows.mockResolvedValue([row]); m.send.mockResolvedValue(true); });
it("snapshots the rendered support email before transport and uses a stable idempotency key", async () => {
  m.send.mockImplementation(async input => { await input.onPrepared(snapshot); return true; });
  await processSupportNotifications("t");
  expect(m.send.mock.calls[0][0]).toMatchObject({ category: "support", templateKey: "support", idempotencyKey: "n", storeSlug: "kosykin", to: row.to });
  expect(m.update.mock.calls.some(([input]) => input.data.emailSnapshot === snapshot)).toBe(true);
  expect(m.update.mock.calls.at(-1)?.[0].data.status).toBe("ACCEPTED");
});
it("reuses the original design and sender snapshot on retries", async () => {
  m.rows.mockResolvedValue([{ ...row, attempts: 1, emailSnapshot: snapshot }]); await processSupportNotifications(); expect(m.send.mock.calls[0][0].prepared).toEqual(snapshot);
});
it("never sends if another worker owns the lease", async () => { m.update.mockResolvedValue({ count: 0 }); await processSupportNotifications(); expect(m.send).not.toHaveBeenCalled(); });
it("never submits when snapshot persistence loses the lease and schedules bounded retry", async () => {
  let submitted = false;
  m.update.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  m.send.mockImplementation(async input => { await input.onPrepared(snapshot); submitted = true; return true; });
  await processSupportNotifications(); expect(submitted).toBe(false); expect(m.update.mock.calls.at(-1)?.[0].data.status).toBe("PENDING");
});
