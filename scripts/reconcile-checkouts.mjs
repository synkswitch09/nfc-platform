// Run every five minutes using your scheduler. No database access on this worker.
const origin = process.env.APP_URL;
const secret = process.env.CHECKOUT_RECONCILE_SECRET;
if (!origin || !secret) throw new Error("APP_URL and CHECKOUT_RECONCILE_SECRET are required");
async function cycle() {
 try {
 const operations = await fetch(new URL("/api/integrations/orders/process", origin), { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(120_000), redirect: "error" });
 if (!operations.ok) console.error(`Order operations worker failed (HTTP ${operations.status})`);
 else console.log(JSON.stringify(await operations.json()));
 } catch { console.error("Order operations request failed; checkout reconciliation will still run."); }
 let cursor;
 let pages = 0;
 do {
  const url = new URL("/api/integrations/checkout/reconcile", origin);
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(120_000), redirect: "error" });
  if (!response.ok) throw new Error(`Checkout reconciliation failed (HTTP ${response.status})`);
  const result = await response.json();
  console.log(JSON.stringify(result.outcomes));
  cursor = result.nextCursor;
  pages++;
  if (pages >= 1000 && cursor) throw new Error("Reconciliation page limit reached; review pending payments");
 } while (cursor);
}

if (process.argv.includes("--watch")) {
  while (true) {
    try { await cycle(); }
    catch { console.error("Checkout reconciliation failed; retrying in five minutes. Inspect application logs."); }
    await new Promise(resolve => setTimeout(resolve, 5 * 60_000));
  }
} else await cycle();
