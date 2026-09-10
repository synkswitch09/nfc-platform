import { describe, expect, it } from "vitest";
import { oauthCallbackUrl, parseRuntimeConfig, publicTagUrl, searchEnginePolicy } from "@/lib/config";

const secret = "a-secret-value-with-more-than-32-characters";
const nonDevelopment = (appEnv: "staging" | "production") => ({
  APP_ENV: appEnv,
  APP_URL: `https://${appEnv === "staging" ? "staging." : ""}tapkin.com.au`,
  DATABASE_URL: `postgresql://tapkin:password@database.example/${appEnv}_db?sslmode=require`,
  DATABASE_EXPECTED_NAME: `${appEnv}_db`,
  SESSION_SECRET: secret,
  ACTIVATION_PEPPER: `${secret}-pepper`,
  STORAGE_PROVIDER: "azure-blob",
  STORAGE_ENVIRONMENT: appEnv,
  AZURE_STORAGE_CONTAINER_URL: `https://tapkin.blob.core.windows.net/tapkin-${appEnv}`,
  AZURE_STORAGE_SAS_TOKEN: "?sv=fake-test-token",
  EMAIL_MODE: appEnv === "staging" ? "sandbox" : "live",
  EMAIL_WEBHOOK_URL: "https://email.example/send",
  EMAIL_WEBHOOK_SECRET: secret,
  STRIPE_SECRET_KEY: appEnv === "staging" ? "sk_test_example" : "sk_live_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: appEnv === "staging" ? "pk_test_example" : "pk_live_example",
});

describe("runtime configuration", () => {
  it("accepts safe development defaults", () => {
    const config = parseRuntimeConfig({ APP_ENV: "development" });
    expect(config.appUrl).toBe("http://localhost:3000");
    expect(config.storage.provider).toBe("local");
    expect(config.email.mode).toBe("mock");
  });

  it.each(["staging", "production"] as const)("rejects incomplete %s configuration", environment => {
    expect(() => parseRuntimeConfig({ APP_ENV: environment })).toThrow("Invalid runtime configuration");
  });

  it("rejects development administrator credentials in production", () => {
    expect(() => parseRuntimeConfig({ ...nonDevelopment("production"), DEV_ADMIN_EMAIL: "admin@example.local", DEV_ADMIN_PASSWORD: "DevAdmin123!" })).toThrow("Development administrator credentials are forbidden");
  });

  it("guards the configured database identity", () => {
    expect(() => parseRuntimeConfig({ ...nonDevelopment("staging"), DATABASE_EXPECTED_NAME: "production_db" })).toThrow("does not match DATABASE_EXPECTED_NAME");
  });

  it("isolates search engine behavior by environment", () => {
    expect(searchEnginePolicy("development").index).toBe(false);
    expect(searchEnginePolicy("staging").follow).toBe(false);
    expect(searchEnginePolicy("production").index).toBe(true);
  });

  it("builds OAuth and permanent NFC URLs only from the configured origin", () => {
    const config = parseRuntimeConfig(nonDevelopment("staging"));
    expect(oauthCallbackUrl("google", config)).toBe("https://staging.tapkin.com.au/api/auth/oauth/google/callback");
    expect(publicTagUrl("X7K29PFQ", config)).toBe("https://staging.tapkin.com.au/t/X7K29PFQ");
  });
});
