import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "@/lib/email";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
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
