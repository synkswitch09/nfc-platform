import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { parseEmailSenders, ticketSupportFooter } from "@/lib/email-senders";
import { sendTransactionalEmail } from "@/lib/email";

const emailStore = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { store: emailStore } }));
beforeEach(() => { emailStore.findUnique.mockImplementation(async ({where}:{where:{slug:string}}) => ({ displayName: where.slug === "kosykin" ? "Kosykin" : "Tapkin", accountConfig: {}, domains: [{ environment: "PRODUCTION", isPrimary: true, protocol: "https", hostname: `${where.slug}.com.au`, port: null }, { environment: "STAGING", isPrimary: true, protocol: "https", hostname: `staging.${where.slug}.com.au`, port: null }] })); });

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe("Mailtrap staging sandbox", () => {
  it("captures the original recipient using the sandbox API and rejects a failed acknowledgement", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      APP_ENV: "staging", APP_URL: "https://staging.tapkin.com.au",
      DATABASE_URL: "postgresql://app:password@db.example/tapkin_staging?sslmode=require", DATABASE_EXPECTED_NAME: "tapkin_staging",
      SESSION_SECRET: "a-staging-session-secret-over-32-characters", ACTIVATION_PEPPER: "a-staging-activation-pepper-over-32-characters",
      STORAGE_PROVIDER: "azure-blob", STORAGE_ENVIRONMENT: "staging", AZURE_STORAGE_CONTAINER_URL: "https://store.blob.core.windows.net/tapkin-staging", AZURE_STORAGE_SAS_TOKEN: "?test-token",
      EMAIL_MODE: "sandbox", EMAIL_PROVIDER: "mailtrap-sandbox", EMAIL_WEBHOOK_URL: "https://sandbox.api.mailtrap.io/api/send/12345", EMAIL_WEBHOOK_SECRET: "test-api-token",
      STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);

    const message = { storeSlug: "tapkin", to: "customer@example.test", subject: "Verify your Tapkin email", text: "Verify your email: https://staging.tapkin.com.au/verify-email?token=secret" };
    expect(await sendTransactionalEmail(message)).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(env.EMAIL_WEBHOOK_URL);
    expect(options.headers).toEqual({ "content-type": "application/json", "Api-Token": env.EMAIL_WEBHOOK_SECRET });
    expect(JSON.parse(options.body as string)).toEqual({ from: { email: "hello@tapkin.com.au", name: "Tapkin" }, to: [{ email: message.to }], subject: message.subject, text: message.text + ticketSupportFooter("https://staging.tapkin.com.au") });
    await expect(sendTransactionalEmail(message)).rejects.toThrow("Email delivery failed");
  });
  it("includes a 3MF as an attachment in the Mailtrap sandbox", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      APP_ENV: "staging", APP_URL: "https://staging.kosykin.com.au",
      DATABASE_URL: "postgresql://app:password@db.example/kosykin_staging?sslmode=require", DATABASE_EXPECTED_NAME: "kosykin_staging",
      SESSION_SECRET: "a-staging-session-secret-over-32-characters", ACTIVATION_PEPPER: "a-staging-activation-pepper-over-32-characters",
      STORAGE_PROVIDER: "azure-blob", STORAGE_ENVIRONMENT: "staging", AZURE_STORAGE_CONTAINER_URL: "https://store.blob.core.windows.net/tapkin-staging", AZURE_STORAGE_SAS_TOKEN: "?test-token",
      EMAIL_MODE: "sandbox", EMAIL_PROVIDER: "mailtrap-sandbox", EMAIL_WEBHOOK_URL: "https://sandbox.api.mailtrap.io/api/send/12345", EMAIL_WEBHOOK_SECRET: "test-api-token",
      STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    await sendTransactionalEmail({ to: "seller@example.test", subject: "Kosykin order", text: "Paid", storeSlug: "kosykin", attachments: [{ filename: "name.3mf", content: Buffer.from("model") }] });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string).attachments).toEqual([{ filename: "name.3mf", content: Buffer.from("model").toString("base64"), type: "model/3mf", disposition: "attachment" }]);
  });
});

describe("Resend production email", () => {
  it("sends an idempotent message with the verified sender and rejects an API failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "email_123" }), { status: 200 })).mockResolvedValueOnce(new Response("invalid sender", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      APP_ENV: "production", APP_URL: "https://tapkin.com.au",
      DATABASE_URL: "postgresql://app:password@db.example/tapkin_production?sslmode=require", DATABASE_EXPECTED_NAME: "tapkin_production",
      SESSION_SECRET: "a-production-session-secret-over-32-characters", ACTIVATION_PEPPER: "a-production-activation-pepper-over-32-characters",
      STORAGE_PROVIDER: "azure-blob", STORAGE_ENVIRONMENT: "production", AZURE_STORAGE_CONTAINER_URL: "https://store.blob.core.windows.net/tapkin-production", AZURE_STORAGE_SAS_TOKEN: "?test-token",
      EMAIL_MODE: "live", EMAIL_PROVIDER: "resend", EMAIL_WEBHOOK_URL: "https://api.resend.com/emails", EMAIL_RESEND_STORES: JSON.stringify({ tapkin: { apiKey: "test-resend-key" } }),
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const message = { storeSlug: "tapkin", to: "customer@example.test", subject: "Verify your Tapkin email", text: "Verification link", idempotencyKey: "notice-123" };
    expect(await sendTransactionalEmail(message)).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(env.EMAIL_WEBHOOK_URL);
    expect(options.headers).toEqual({ "content-type": "application/json", authorization: "Bearer test-resend-key", "Idempotency-Key": message.idempotencyKey });
    expect(JSON.parse(options.body as string)).toEqual({ from: "Tapkin <hello@tapkin.com.au>", to: [message.to], subject: message.subject, text: message.text + ticketSupportFooter("https://tapkin.com.au") });
    await expect(sendTransactionalEmail(message)).rejects.toThrow("Email delivery failed");
  });

  it("uses the Kosykin domain key only for Kosykin messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_456" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      APP_ENV: "production", APP_URL: "https://tapkin.com.au",
      DATABASE_URL: "postgresql://app:password@db.example/tapkin_production?sslmode=require", DATABASE_EXPECTED_NAME: "tapkin_production",
      SESSION_SECRET: "a-production-session-secret-over-32-characters", ACTIVATION_PEPPER: "a-production-activation-pepper-over-32-characters",
      STORAGE_PROVIDER: "azure-blob", STORAGE_ENVIRONMENT: "production", AZURE_STORAGE_CONTAINER_URL: "https://store.blob.core.windows.net/tapkin-production", AZURE_STORAGE_SAS_TOKEN: "?test-token",
      EMAIL_MODE: "live", EMAIL_PROVIDER: "resend", EMAIL_WEBHOOK_URL: "https://api.resend.com/emails", EMAIL_RESEND_STORES: JSON.stringify({ tapkin: { apiKey: "tapkin-only-key" }, kosykin: { apiKey: "kosykin-only-key" } }),
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    await sendTransactionalEmail({ to: "customer@example.test", subject: "Kosykin order", text: "Shipped", storeSlug: "kosykin", attachments: [{ filename: "order.3mf", content: Buffer.from("printable model") }] });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({ authorization: "Bearer kosykin-only-key" });
    expect(JSON.parse(options.body as string).from).toBe("Kosykin <hello@kosykin.com.au>");
    expect(JSON.parse(options.body as string).text).toContain("https://kosykin.com.au/dashboard/help");
    expect(JSON.parse(options.body as string)).not.toHaveProperty("reply_to");
    expect(JSON.parse(options.body as string).attachments).toEqual([{ filename: "order.3mf", content: Buffer.from("printable model").toString("base64") }]);
    const senders = parseEmailSenders(undefined, "hello@kosykin.com.au", "Kosykin");
    senders.orders = { address: "dispatch@kosykin.com.au", name: "Kosykin Dispatch" };
    emailStore.findUnique.mockResolvedValueOnce({ displayName: "Kosykin", accountConfig: { emailSenders: senders }, domains: [{ environment: "PRODUCTION", isPrimary: true, protocol: "https", hostname: "kosykin.com.au", port: null }] });
    await sendTransactionalEmail({ to: "customer@example.test", subject: "Shipped", text: "Your order is on its way.", storeSlug: "kosykin", category: "orders" });
    const custom = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(custom.from).toBe("Kosykin Dispatch <dispatch@kosykin.com.au>");
    expect(custom.text).toContain("Replies to this address are not monitored");
    vi.stubEnv("EMAIL_RESEND_STORES", JSON.stringify({ tapkin: { apiKey: "tapkin-only-key" } }));
    await expect(sendTransactionalEmail({ to: "customer@example.test", subject: "Kosykin order", text: "Shipped", storeSlug: "kosykin" })).rejects.toThrow("Resend sender is not configured for store");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("mock transactional email", () => {
  it("captures development messages in a private test outbox without logging credentials", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "tapkin-email-"));
    temporaryDirectories.push(directory);
    const outboxPath = path.join(directory, "outbox.ndjson");
    const verificationPath = "/verify-email?token=test-only-verification-token";
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("EMAIL_MODE", "mock");
    vi.stubEnv("EMAIL_TEST_OUTBOX_PATH", outboxPath);

    await sendTransactionalEmail({ to: "customer@example.test", subject: "Verify your Tapkin email", text: `Verify your email: http://localhost:3000${verificationPath}`, storeSlug: "tapkin" });

    expect(await readFile(outboxPath, "utf8")).toContain(verificationPath);
    expect((await stat(outboxPath)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-only-verification-token");
  });
});
