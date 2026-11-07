// Dedicated scheduler entry point. No broker secrets or database access required here.
const origin = process.env.APP_URL;
const secret = process.env.TRADING_WORKER_SECRET || process.env.CHECKOUT_RECONCILE_SECRET;
if (!origin || !secret || secret.length < 32) throw new Error("APP_URL and a worker secret of at least 32 characters are required.");
const response = await fetch(new URL("/api/assistants/trading/process", origin), {
  method: "POST", headers: { authorization: `Bearer ${secret}` },
  redirect: "error", signal: AbortSignal.timeout(220000),
});
if (!response.ok) throw new Error(`Paper trading worker failed (HTTP ${response.status}). Check the private dashboard and server configuration.`);
console.log(JSON.stringify(await response.json()));
