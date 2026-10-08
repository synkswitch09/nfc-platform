import { describe, expect, it } from "vitest";
import { googleVerificationToken, storeGoogleVerification } from "@/lib/site-verification";

describe("store Google verification", () => {
  const environment = { GOOGLE_SITE_VERIFICATION_TAPKIN: "tapkin-token", GOOGLE_SITE_VERIFICATION_KOSYKIN: "kosykin-token" };
  it("uses only the current store's legacy token until saved in the CMS", () => {
    expect(storeGoogleVerification({ slug: "tapkin" }, environment)).toBe("tapkin-token");
    expect(storeGoogleVerification({ slug: "kosykin" }, environment)).toBe("kosykin-token");
    expect(storeGoogleVerification({ slug: "other" }, environment)).toBeUndefined();
  });
  it("prefers the CMS and permits explicit removal without reviving the old token", () => {
    expect(storeGoogleVerification({ slug: "kosykin", googleSiteVerification: "new-token" }, environment)).toBe("new-token");
    expect(storeGoogleVerification({ slug: "kosykin", googleSiteVerification: "" }, environment)).toBeUndefined();
  });
  it("rejects markup and invalid tokens", () => {
    expect(googleVerificationToken.safeParse('<meta name="google-site-verification" content="x">').success).toBe(false);
    expect(storeGoogleVerification({ slug: "kosykin", googleSiteVerification: '<script>' }, environment)).toBeUndefined();
  });
});
