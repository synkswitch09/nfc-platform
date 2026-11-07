export function tradingConfig(env: Record<string, string | undefined> = process.env) {
  const raw = env.TRADING_IBKR_BASE_URL?.trim();
  let ibkrUrl: string | undefined;
  if (raw) {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || !["https:", "http:"].includes(url.protocol))
      throw new Error("Invalid TRADING_IBKR_BASE_URL.");
    if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && env.TRADING_IBKR_PRIVATE_HTTP !== "true")
      throw new Error("Use HTTPS for IBKR or explicitly allow an isolated private HTTP gateway.");
    ibkrUrl = url.href.replace(/\/$/, "");
  }
  return {
    enabled: env.TRADING_ENABLED === "true",
    ownerId: env.TRADING_OWNER_USER_ID?.trim(),
    binanceKey: env.TRADING_BINANCE_API_KEY?.trim(),
    binanceSecret: env.TRADING_BINANCE_API_SECRET?.trim(),
    binanceUrl: env.TRADING_BINANCE_TESTNET === "true" ? "https://testnet.binance.vision" : "https://api.binance.com",
    binanceTestnet: env.TRADING_BINANCE_TESTNET === "true",
    ibkrUrl, ibkrAccount: env.TRADING_IBKR_ACCOUNT_ID?.trim(),
    ibkrProxyToken: env.TRADING_IBKR_PROXY_TOKEN?.trim(),
    aiModel: env.TRADING_AI_MODEL?.trim(),
    aiKey: env.ANTHROPIC_API_KEY?.trim(),
  };
}
export function readiness() {
  const c = tradingConfig();
  return { enabled: c.enabled, ownerConfigured: Boolean(c.ownerId),
    binance: Boolean(c.binanceKey && c.binanceSecret), binanceTestnet: c.binanceTestnet,
    ibkr: Boolean(c.ibkrUrl && c.ibkrAccount), ai: Boolean(c.aiKey && c.aiModel),
    executionMode: "PAPER" as const };
}
export function canAccessTrading(user: { id: string; role: string; emailVerifiedAt: Date | null } | null, ownerId?: string) {
  return Boolean(user && user.role === "ADMIN" && user.emailVerifiedAt && ownerId && user.id === ownerId);
}
