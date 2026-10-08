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

  it("treats blank optional service settings as disabled", () => {
    expect(parseRuntimeConfig({ APP_ENV: "development", STRIPE_SECRET_KEY: "", EMAIL_WEBHOOK_URL: "", AZURE_STORAGE_CONTAINER_URL: "" }).stripe.secretKey).toBeUndefined();
  });

  it("allows an isolated mock-email outbox only in development", () => {
    expect(parseRuntimeConfig({ APP_ENV: "development", EMAIL_TEST_OUTBOX_PATH: "/tmp/tapkin-test-outbox.ndjson" }).email.testOutboxPath).toBe("/tmp/tapkin-test-outbox.ndjson");
    expect(() => parseRuntimeConfig({ ...nonDevelopment("staging"), EMAIL_TEST_OUTBOX_PATH: "/tmp/tapkin-test-outbox.ndjson" })).toThrow("test email outbox is restricted to development");
  });

  it("limits Mailtrap Sandbox to a staging inbox without environment sender addresses", () => {
    const staging = { ...nonDevelopment("staging"), EMAIL_PROVIDER: "mailtrap-sandbox", EMAIL_WEBHOOK_URL: "https://sandbox.api.mailtrap.io/api/send/12345" };
    expect(parseRuntimeConfig(staging).email.provider).toBe("mailtrap-sandbox");
    expect(() => parseRuntimeConfig({ ...staging, EMAIL_WEBHOOK_URL: "https://send.api.mailtrap.io/api/send" })).toThrow("exact HTTPS sandbox inbox URL");
    expect(() => parseRuntimeConfig({ ...staging, APP_ENV: "production", STRIPE_SECRET_KEY: "sk_live_example", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_example", EMAIL_MODE: "live" })).toThrow("restricted to staging");
  });

  it("requires the official Resend endpoint while senders are configured per store", () => {
    const production = { ...nonDevelopment("production"), STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined, EMAIL_PROVIDER: "resend", EMAIL_WEBHOOK_URL: "https://api.resend.com/emails" };
    expect(parseRuntimeConfig(production).email.provider).toBe("resend");
    expect(parseRuntimeConfig({ ...production, EMAIL_WEBHOOK_SECRET_KOSYKIN: secret }).email.provider).toBe("resend");
    expect(parseRuntimeConfig({ ...production, EMAIL_FROM_ADDRESS: "obsolete invalid value", EMAIL_FROM_ADDRESS_KOSYKIN: "obsolete" }).email).not.toHaveProperty("fromAddress");
    expect(() => parseRuntimeConfig({ ...production, EMAIL_WEBHOOK_URL: "https://email.example/send" })).toThrow("official HTTPS email endpoint");
    expect(() => parseRuntimeConfig({ ...production, APP_ENV: "staging", EMAIL_MODE: "sandbox" })).toThrow("live production email");
  });

  it("requires an explicit deployment environment in a production runtime", () => {
    expect(() => parseRuntimeConfig({ NODE_ENV: "production" })).toThrow("APP_ENV must be explicit");
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
    expect(searchEnginePolicy("production", true).index).toBe(false);
  });

  it("accepts production preview only without payment or email credentials", () => {
    const live = nonDevelopment("production");
    const preview = { ...live, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined, EMAIL_WEBHOOK_URL: undefined, EMAIL_WEBHOOK_SECRET: undefined, PRODUCTION_PREVIEW_MODE: "true", EMAIL_MODE: "mock" };
    expect(parseRuntimeConfig(preview).previewMode).toBe(true);
    expect(() => parseRuntimeConfig({ ...preview, STRIPE_SECRET_KEY: live.STRIPE_SECRET_KEY })).toThrow("must not have Stripe credentials");
    expect(() => parseRuntimeConfig({ ...preview, EMAIL_WEBHOOK_URL: live.EMAIL_WEBHOOK_URL })).toThrow("must not deliver email");
    expect(() => parseRuntimeConfig({ ...nonDevelopment("staging"), PRODUCTION_PREVIEW_MODE: "true" })).toThrow("restricted to production");
  });

  it("indexes the official production site while checkout stays closed", () => {
    const live = nonDevelopment("production");
    const closed = { ...live, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined, PRODUCTION_PREVIEW_MODE: "false" };
    expect(parseRuntimeConfig(closed).checkoutEnabled).toBe(false);
    expect(searchEnginePolicy("production", parseRuntimeConfig(closed).previewMode).index).toBe(true);
    expect(() => parseRuntimeConfig({ ...closed, PRODUCTION_CHECKOUT_ENABLED: "true" })).toThrow("Stripe live secret key");
    expect(parseRuntimeConfig({ ...live, PRODUCTION_CHECKOUT_ENABLED: "true" }).checkoutEnabled).toBe(true);
    expect(() => parseRuntimeConfig({ ...closed, STRIPE_SECRET_KEY: live.STRIPE_SECRET_KEY })).toThrow("leave Stripe credentials unset");
  });

  it("builds OAuth and permanent NFC URLs only from the configured origin", () => {
    const config = parseRuntimeConfig(nonDevelopment("staging"));
    expect(oauthCallbackUrl("google", config)).toBe("https://staging.tapkin.com.au/api/auth/oauth/google/callback");
    expect(publicTagUrl("X7K29PFQ", config)).toBe("https://staging.tapkin.com.au/t/X7K29PFQ");
  });
});
