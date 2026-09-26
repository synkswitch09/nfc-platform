import { appendFile } from "node:fs/promises";
import { getRuntimeConfig } from "@/lib/config";
import { logEvent } from "@/lib/logger";

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; idempotencyKey?: string }) {
  const { email, appEnv } = getRuntimeConfig();
  if (email.mode === "mock") {
    if (email.testOutboxPath) {
      await appendFile(email.testOutboxPath, `${JSON.stringify({ ...input, createdAt: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
    }
    logEvent("info", "email_mocked", { messageType: input.subject, recipientDomain: input.to.split("@")[1] ?? "invalid" });
    return false;
  }
  if (!email.webhookUrl || !email.webhookSecret) throw new Error("Email provider is not configured");
  if (email.provider === "mailtrap-sandbox") {
    if (!email.fromAddress) throw new Error("Mailtrap Sandbox sender is not configured");
    const response = await fetch(email.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "Api-Token": email.webhookSecret },
      body: JSON.stringify({ from: { email: email.fromAddress }, to: [{ email: input.to }], subject: input.subject, text: input.text }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!response.ok || (await response.json() as { success?: boolean }).success !== true) throw new Error("Email delivery failed");
    return true;
  }
  const response = await fetch(email.webhookUrl, { method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${email.webhookSecret}`, ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})}, body:JSON.stringify({ ...input, environment: appEnv, mode: email.mode }), signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw new Error("Email delivery failed");
  return true;
}
