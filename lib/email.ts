import { appendFile } from "node:fs/promises";
import { getRuntimeConfig } from "@/lib/config";
import { logEvent } from "@/lib/logger";

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string }) {
  const { email, appEnv } = getRuntimeConfig();
  if (email.mode === "mock") {
    if (email.testOutboxPath) {
      await appendFile(email.testOutboxPath, `${JSON.stringify({ ...input, createdAt: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
    }
    logEvent("info", "email_mocked", { messageType: input.subject, recipientDomain: input.to.split("@")[1] ?? "invalid" });
    return false;
  }
  if (!email.webhookUrl || !email.webhookSecret) throw new Error("Email provider is not configured");
  const response = await fetch(email.webhookUrl, { method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${email.webhookSecret}`}, body:JSON.stringify({ ...input, environment: appEnv, mode: email.mode }) });
  if (!response.ok) throw new Error("Email delivery failed");
  return true;
}
