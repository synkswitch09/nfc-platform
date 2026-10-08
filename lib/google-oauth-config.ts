import { z } from "zod";

export const googleOAuthStoresSchema = z.record(z.string().regex(/^[a-z0-9-]+$/), z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
}).strict());
export const googleOAuthStores = z.preprocess(value => {
  if (value === undefined || (typeof value === "string" && !value.trim())) return undefined;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}, googleOAuthStoresSchema.optional());

export function googleOAuthCredentials(storeSlug: string, environment: Record<string, string | undefined> = process.env) {
  const result = googleOAuthStores.safeParse(environment.GOOGLE_OAUTH_STORES);
  if (!result.success) throw new Error("Invalid store Google OAuth configuration");
  // Once store credentials are configured, a missing store must never use another brand's client.
  if (result.data !== undefined) return Object.hasOwn(result.data, storeSlug) ? result.data[storeSlug] : undefined;
  // Preserve existing deployments until their per-store credentials are installed.
  const clientId = environment.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}
