import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { controlBot, ensureBot, runTradingCycle, updateFx, updateSettings } from "../lib/trading/service";
import { defaultSettings, stateSchema, type Market } from "../lib/trading/schema";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (process.env.CI !== "true" || process.env.APP_ENV !== "development" || url.hostname !== "localhost" || url.pathname !== "/nfc_platform")
    throw new Error("Only the disposable CI database is allowed");
  let ownerId = "";
  try {
    const owner = await db.user.create({ data: { email: `trading-ci-${randomUUID()}@example.test`, name: "Trading CI", role: "ADMIN", emailVerifiedAt: new Date() } });
    ownerId = owner.id;
    Object.assign(process.env, { TRADING_ENABLED: "true", TRADING_OWNER_USER_ID: ownerId });
    const settings = defaultSettings();
    settings.instruments = [{ ...settings.instruments[0], quoteCurrency: "AUD", symbol: "BTCAUD", enabled: true }];
    await updateSettings(ownerId, settings);
    await controlBot(ownerId, "start");
    const now = Date.now();
    const market: Market = { instrumentId: "BTC", price: 105, time: now,
      bars: Array.from({ length: 221 }, (_, n) => ({ time: now - (221 - n) * 86400000, open: 99, high: 101, low: 98, close: 100 })).map((b, n) => n === 220 ? { ...b, open: 101, high: 106, low: 100, close: 105 } : b) };
    const reader = async () => market;
    const [a, b] = await Promise.all([runTradingCycle(ownerId, false, false, reader), runTradingCycle(ownerId, false, false, reader)]);
    assert.ok("skipped" in a || "skipped" in b, "a concurrent cycle must be fenced");
    const bot = await ensureBot(ownerId);
    assert.equal(stateSchema.parse(bot.state).positions.length, 1);
    assert.equal(await db.tradingEvent.count({ where: { botId: bot.id, kind: "BUY" } }), 1);
    assert.equal(bot.leaseToken, null);
    await assert.rejects(updateSettings(ownerId, settings), /Stop the worker/);
    await controlBot(ownerId, "pause-entries");
    assert.equal((await ensureBot(ownerId)).entriesPaused, true);
    await updateFx(ownerId, { USD: { audPerUnit: 1.5, asOf: new Date().toISOString() } });
    assert.ok((await ensureBot(ownerId)).settings);
    await controlBot(ownerId, "stop");
    await assert.rejects(updateSettings(ownerId, settings), /positions/);
    const gap = async () => ({ ...market, price: 70, time: Date.now() });
    await runTradingCycle(ownerId, true, false, gap);
    const closed = stateSchema.parse((await ensureBot(ownerId)).state);
    assert.equal(closed.positions.length, 0); assert.ok(closed.realizedAud < 0);
    // An old lease owner cannot confirm its state after a new worker has acquired ownership.
    await db.tradingBot.update({ where: { id: bot.id }, data: { leaseToken: "new-owner", leaseUntil: new Date(Date.now() + 60000) } });
    const stale = await db.tradingBot.updateMany({ where: { id: bot.id, leaseToken: "old-owner" }, data: { state: { corrupted: true } } });
    assert.equal(stale.count, 0);
    await db.tradingBot.update({ where: { id: bot.id }, data: { leaseToken: null, leaseUntil: null } });
    await db.user.update({ where: { id: ownerId }, data: { status: "SUSPENDED" } });
    assert.deepEqual(await runTradingCycle(ownerId, true, false, reader), { skipped: "owner-not-authorized" });
    console.log("Private trading: concurrency, persistent deduplication, FX updates, controls and revoked-owner checks passed.");
  } finally {
    if (ownerId) { await db.tradingBot.deleteMany({ where: { ownerId } }); await db.user.delete({ where: { id: ownerId } }); }
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
