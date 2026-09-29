// Run against an authorised public production origin after deployment.
const input = process.argv.find(argument => argument.startsWith("--origin="))?.slice(9);
if (!input) throw new Error("Usage: node scripts/check-search-readiness.mjs --origin=https://your-store.example");
const origin = new URL(input);
if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Provide a production HTTPS origin without a path or query");
const base = origin.origin;
const response = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(10_000) });
if (!response.ok) throw new Error(`Sitemap HTTP ${response.status}`);
const xml = await response.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replaceAll("&amp;", "&"));
if (!urls.length || urls.length > 10_000) throw new Error(`Unexpected sitemap URL count: ${urls.length}`);
const failures = [];
for (const loc of urls) {
  try {
    const url = new URL(loc);
    if (url.origin !== base) throw new Error("URL belongs to another store");
    const page = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (page.status !== 200) throw new Error(`HTTP ${page.status}`);
    const html = await page.text();
    const tags = html.match(/<link\b[^>]*>/gi) ?? [];
    const canonicalTag = tags.find(tag => /\brel=["']canonical["']/i.test(tag));
    const canonical = canonicalTag?.match(/\bhref=["']([^"']+)["']/i)?.[1]?.replaceAll("&amp;", "&");
    if (!canonical || new URL(canonical, base).href !== url.href) throw new Error(`Canonical mismatch: ${canonical ?? "missing"}`);
    if (/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) || /<meta\b[^>]*content=["'][^"']*noindex[^>]*name=["']robots["']/i.test(html) || /noindex/i.test(page.headers.get("x-robots-tag") ?? "")) throw new Error("Noindex page in sitemap");
  } catch (error) { failures.push(`${loc}: ${error instanceof Error ? error.message : String(error)}`); }
}
const robots = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(10_000) });
if (!robots.ok || !(await robots.text()).includes(`${base}/sitemap.xml`)) failures.push("robots.txt does not list this store's sitemap");
console.log(`${base}: ${urls.length} sitemap URLs checked; ${failures.length} failures`);
for (const issue of failures) console.error(issue);
if (failures.length) process.exitCode = 1;
