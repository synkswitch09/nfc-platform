import { z } from "zod";

export const googleVerificationToken = z.string().trim().max(200).regex(/^[A-Za-z0-9_-]*$/, "Paste only the Google verification content code, without the HTML tag");
export function storeGoogleVerification(store: { slug: string; googleSiteVerification?: string | null }, environment: Record<string, string | undefined> = process.env) {
  const value = store.googleSiteVerification ?? environment[`GOOGLE_SITE_VERIFICATION_${store.slug.toUpperCase().replaceAll("-", "_")}`] ?? "";
  const result = googleVerificationToken.safeParse(value);
  return result.success && result.data ? result.data : undefined;
}
