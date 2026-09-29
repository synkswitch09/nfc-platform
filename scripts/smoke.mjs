const baseUrl = (process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) throw new Error("SMOKE_BASE_URL is required");
const base = new URL(baseUrl);
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Smoke tests require HTTPS outside localhost");

const checks = [["liveness", "/api/health/live"], ["readiness", "/api/health/ready"], ["homepage", "/"], ["shop", "/shop"], ["login", "/login"]];
if (process.env.SMOKE_PRODUCT_SLUG) checks.push(["product", `/products/${encodeURIComponent(process.env.SMOKE_PRODUCT_SLUG)}`]);
if (process.env.SMOKE_TAG_ID) checks.push(["public-tag", `/t/${encodeURIComponent(process.env.SMOKE_TAG_ID)}`]);

for (const [name, pathname] of checks) {
  const url = new URL(pathname, base);
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
      if (response.status >= 200 && response.status < 400) {
        console.info(`${name}: HTTP ${response.status}`);
        lastError = null;
        break;
      }
      lastError = new Error(`HTTP ${response.status}`);
      if (response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
    console.warn(`${name} attempt ${attempt} failed: ${lastError.message}`);
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (lastError) throw new Error(`${name} smoke check failed for ${url}: ${lastError.message}`, { cause: lastError });
}
