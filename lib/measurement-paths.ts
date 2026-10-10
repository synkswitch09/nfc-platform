// A shared client-safe allowlist; private/token-bearing routes are never page views.
export const safeShoppingPath = (path: string) => /^(\/(?:shop|faq|privacy|terms|cart)?|\/products\/[a-z0-9-]+)$/.test(path);
