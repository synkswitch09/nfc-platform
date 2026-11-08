import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { controlResearch, ensureResearch, runResearchCycle } from "../lib/trading/research/service";
import { DAY, initialPolicies, type Dataset, type LabState } from "../lib/trading/research/schema";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (process.env.CI !== "true" || process.env.APP_ENV !== "development" || url.hostname !== "localhost" || url.pathname !== "/nfc_platform") throw new Error("Only the disposable CI database is allowed");
  let ownerId = "";
  try {
    const owner = await db.user.create({ data: { email: `research-ci-${randomUUID()}@example.test`, name: "Research CI", role: "ADMIN", emailVerifiedAt: new Date() } }); ownerId = owner.id;
    Object.assign(process.env, { TRADING_ENABLED: "true", TRADING_OWNER_USER_ID: ownerId });
    await controlResearch(ownerId, "start", 1000);
    const today = Math.floor(Date.now() / DAY);
    function fixture(extra = 0): Dataset { return { fetchedAt: Date.now(), fx: {}, issues: [], sources: ["disposable fixture"], assets: [{ id: "BTCUSDT", symbol: "BTCAUD", provider: "BINANCE", kind: "CRYPTO", currency: "AUD", feeBps: 10, minimumFee: 0, slippageBps: 10,
      bars: Array.from({ length: 600 + extra }, (_, index) => { const p = 100 + index * .2 + 4 * Math.sin(index / 15); return { day: today - 630 + index, open: p, high: p + .1, low: p - .1, close: p }; }) }] }; }
    const [a, b] = await Promise.all([runResearchCycle(ownerId, { load: async () => fixture() }), runResearchCycle(ownerId, { load: async () => fixture() })]);
    assert.ok("skipped" in a || "skipped" in b);
    let lab = await ensureResearch(ownerId), state = lab.state as unknown as LabState;
    assert.equal(state.generation, 1); assert.equal(state.stage, "REVIEW");
    assert.equal(await db.tradingResearchBatch.count({ where: { researchId: lab.id } }), 1);
    const sealed = state.sealEnd!;
    await db.tradingResearch.update({ where: { id: lab.id }, data: { lastRunAt: new Date(0) } });
    let reviews = 0;
    const review = async () => { reviews++; return { review: "A bounded candidate for strictly new observations.", proposals: [initialPolicies()[0]], model: "fake-ci-model", inputTokens: 100, outputTokens: 50 }; };
    await runResearchCycle(ownerId, { review });
    lab = await ensureResearch(ownerId); state = lab.state as unknown as LabState;
    assert.equal(reviews, 1); assert.equal(state.stage, "FORWARD"); assert.equal(state.sealEnd, sealed);
    // Not enough new observations: never reuse the sealed historical test as another successful test.
    await db.tradingResearch.update({ where: { id: lab.id }, data: { lastRunAt: new Date(0) } });
    await runResearchCycle(ownerId, { review });
    assert.equal((await ensureResearch(ownerId)).state && ((await ensureResearch(ownerId)).state as unknown as LabState).generation, 1);
    assert.equal(reviews, 1);
    await db.tradingResearch.update({ where: { id: lab.id }, data: { lastRunAt: new Date(0), dataset: { ...fixture(), fetchedAt: 0 } as never } });
    await runResearchCycle(ownerId, { load: async () => fixture(20), review });
    lab = await ensureResearch(ownerId); state = lab.state as unknown as LabState;
    assert.equal(state.generation, 2); assert.equal(state.sealEnd, sealed + 20); assert.equal(state.stage, "REVIEW");
    assert.equal(await db.tradingResearchBatch.count({ where: { researchId: lab.id } }), 2);
    await assert.rejects(controlResearch(ownerId, "start", 2000), /initial capital/);
    await controlResearch(ownerId, "pause");
    assert.equal((await ensureResearch(ownerId)).enabled, false);
    console.log("Autonomous research: capital-only control, persistent leases, bounded review, fresh forward windows and snapshot audit passed.");
  } finally {
    if (ownerId) { await db.tradingBot.deleteMany({ where: { ownerId } }); await db.user.delete({ where: { id: ownerId } }); }
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
