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
  return result.data && Object.hasOwn(result.data, storeSlug) ? result.data[storeSlug] : undefined;
}
