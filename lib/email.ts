import { appendFile } from "node:fs/promises";
import { getRuntimeConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { parseEmailSenders, resolveEmailSender, ticketSupportFooter, type EmailCategory } from "@/lib/email-senders";
import { logEvent } from "@/lib/logger";

export type EmailAttachment = { filename: string; content: Buffer };

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; idempotencyKey?: string; storeSlug?: string; attachments?: EmailAttachment[]; category?: EmailCategory }) {
  const { email, appEnv } = getRuntimeConfig();
  const fallbackAddress = input.storeSlug === "kosykin" ? email.kosykinFromAddress ?? (email.mode !== "live" ? "hello@kosykin.com.au" : undefined) : email.fromAddress;
  if (email.provider === "resend" && input.storeSlug === "kosykin" && (!fallbackAddress || !email.kosykinWebhookSecret)) throw new Error("Resend sender is not configured for store");
  let sender = { address: fallbackAddress ?? "", name: "", from: fallbackAddress ?? "" };
  let text = input.text;
  if (input.storeSlug) {
    const store = await db.store.findUnique({ where: { slug: input.storeSlug }, select: { displayName: true, accountConfig: true, domains: true } });
    if (!store) throw new Error("Email store is not configured");
    const config = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
    // Sandbox uses the same brand senders while its provider still captures all delivery.
    const address = fallbackAddress ?? (email.mode !== "live" ? `hello@${input.storeSlug}.com.au` : "");
    sender = resolveEmailSender(parseEmailSenders(config.emailSenders, address, store.displayName), input.category ?? "default", address);
    const domain = store.domains.find(row => row.environment === appEnv.toUpperCase() && row.isPrimary);
    const origin = domain ? `${domain.protocol}://${domain.hostname}${domain.port ? `:${domain.port}` : ""}` : undefined;
    text += ticketSupportFooter(origin);
  }
  if (email.mode === "mock") {
    if (email.testOutboxPath) {
      await appendFile(email.testOutboxPath, `${JSON.stringify({ ...input, text, from: sender.from, attachments: input.attachments?.map(({ filename, content }) => ({ filename, size: content.length })), createdAt: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
    }
    logEvent("info", "email_mocked", { messageType: input.subject, recipientDomain: input.to.split("@")[1] ?? "invalid" });
    return false;
  }
  if (!email.webhookUrl || !email.webhookSecret) throw new Error("Email provider is not configured");
  if (email.provider === "mailtrap-sandbox") {
    // Mailtrap captures the same print attachment without delivering to a real inbox.
    if (!sender.address) throw new Error("Mailtrap Sandbox sender is not configured");
    const response = await fetch(email.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "Api-Token": email.webhookSecret },
      body: JSON.stringify({ from: { email: sender.address, ...(sender.name ? { name: sender.name } : {}) }, to: [{ email: input.to }], subject: input.subject, text, ...(input.attachments?.length ? { attachments: input.attachments.map(({ filename, content }) => ({ filename, content: content.toString("base64"), type: "model/3mf", disposition: "attachment" })) } : {}) }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!response.ok || (await response.json() as { success?: boolean }).success !== true) throw new Error("Email delivery failed");
    return true;
  }
  if (email.provider === "resend") {
    const fromAddress = sender.from;
    const secret = input.storeSlug === "kosykin" ? email.kosykinWebhookSecret : email.webhookSecret;
    if (!fromAddress || !secret) throw new Error("Resend sender is not configured for store");
    const response = await fetch(email.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}`, ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}) },
      body: JSON.stringify({ from: fromAddress, to: [input.to], subject: input.subject, text, ...(input.attachments?.length ? { attachments: input.attachments.map(({ filename, content }) => ({ filename, content: content.toString("base64") })) } : {}) }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Email delivery failed");
    return true;
  }
  const response = await fetch(email.webhookUrl, { method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${email.webhookSecret}`, ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})}, body:JSON.stringify({ ...input, text, from: sender.from, environment: appEnv, mode: email.mode }), signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw new Error("Email delivery failed");
  return true;
}
