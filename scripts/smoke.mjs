const baseUrl = (process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) throw new Error("SMOKE_BASE_URL is required");
const base = new URL(baseUrl);
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Smoke tests require HTTPS outside localhost");

const checks = [["liveness", "/api/health/live"], ["readiness", "/api/health/ready"], ["homepage", "/"], ["shop", "/shop"], ["login", "/login"]];
if (process.env.SMOKE_PRODUCT_SLUG) checks.push(["product", `/products/${encodeURIComponent(process.env.SMOKE_PRODUCT_SLUG)}`]);
if (process.env.SMOKE_TAG_ID) checks.push(["public-tag", `/t/${encodeURIComponent(process.env.SMOKE_TAG_ID)}`]);

for (const [name, pathname] of checks) {
  const response = await fetch(new URL(pathname, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  if (response.status < 200 || response.status >= 400) throw new Error(`${name} smoke check failed with HTTP ${response.status}`);
  console.info(`${name}: HTTP ${response.status}`);
}
