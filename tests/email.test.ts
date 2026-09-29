import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "@/lib/email";

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
      EMAIL_MODE: "sandbox", EMAIL_PROVIDER: "mailtrap-sandbox", EMAIL_FROM_ADDRESS: "staging@tapkin.com.au", EMAIL_WEBHOOK_URL: "https://sandbox.api.mailtrap.io/api/send/12345", EMAIL_WEBHOOK_SECRET: "test-api-token",
      STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_example", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);

    const message = { to: "customer@example.test", subject: "Verify your Tapkin email", text: "Verify your email: https://staging.tapkin.com.au/verify-email?token=secret" };
    expect(await sendTransactionalEmail(message)).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(env.EMAIL_WEBHOOK_URL);
    expect(options.headers).toEqual({ "content-type": "application/json", "Api-Token": env.EMAIL_WEBHOOK_SECRET });
    expect(JSON.parse(options.body as string)).toEqual({ from: { email: env.EMAIL_FROM_ADDRESS }, to: [{ email: message.to }], subject: message.subject, text: message.text });
    await expect(sendTransactionalEmail(message)).rejects.toThrow("Email delivery failed");
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

    await sendTransactionalEmail({ to: "customer@example.test", subject: "Verify your Tapkin email", text: `Verify your email: http://localhost:3000${verificationPath}` });

    expect(await readFile(outboxPath, "utf8")).toContain(verificationPath);
    expect((await stat(outboxPath)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-only-verification-token");
  });
});
