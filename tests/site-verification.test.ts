import { describe, expect, it } from "vitest";
import { googleVerificationToken, storeGoogleVerification } from "@/lib/site-verification";

describe("store Google verification", () => {
  it("requires a CMS token without an environment fallback", () => {
    expect(storeGoogleVerification({ slug: "tapkin" })).toBeUndefined();
    expect(storeGoogleVerification({ slug: "kosykin" })).toBeUndefined();
  });
  it("prefers the CMS and permits explicit removal without reviving the old token", () => {
    expect(storeGoogleVerification({ slug: "kosykin", googleSiteVerification: "new-token" })).toBe("new-token");
    expect(storeGoogleVerification({ slug: "kosykin", googleSiteVerification: "" })).toBeUndefined();
  });
  it("rejects markup and invalid tokens", () => {
    expect(googleVerificationToken.safeParse('<meta name="google-site-verification" content="x">').success).toBe(false);
    expect(storeGoogleVerification({ slug: "kosykin", googleSiteVerification: '<script>' })).toBeUndefined();
  });
});
