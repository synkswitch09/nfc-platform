import { appendFile } from "node:fs/promises";
import { getRuntimeConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { parseEmailSenders, resolveEmailSender, defaultStoreSender, type EmailCategory } from "@/lib/email-senders";
import { defaultEmailTemplate, parseEmailTemplates, renderEmailTemplate, type EmailTemplateKey, type EmailTemplate, type PreparedEmail } from "@/lib/email-templates";
import { logEvent } from "@/lib/logger";

export type EmailAttachment = { filename: string; content: Buffer };

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; idempotencyKey?: string; storeSlug: string; attachments?: EmailAttachment[]; category?: EmailCategory; templateKey?: EmailTemplateKey; templateFields?: Record<string, string>; customerName?: string | null; previewTemplate?: EmailTemplate; prepared?: PreparedEmail; onPrepared?: (message: PreparedEmail) => Promise<void> }) {
  const { email, appEnv } = getRuntimeConfig();
  const store = await db.store.findUnique({ where: { slug: input.storeSlug }, select: { displayName: true, logoUrl: true, accountConfig: true, domains: true } });
  if (!store) throw new Error("Email store is not configured");
  const config = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
  const fallbackAddress = defaultStoreSender(store.domains);
  const currentSender = resolveEmailSender(parseEmailSenders(config.emailSenders, fallbackAddress, store.displayName), input.category ?? "default", fallbackAddress);
  const domain = store.domains.find(row => row.environment === appEnv.toUpperCase() && row.isPrimary);
  const origin = domain ? `${domain.protocol}://${domain.hostname}${domain.port ? `:${domain.port}` : ""}` : undefined;
  const key = input.templateKey ?? "default";
  const template = input.previewTemplate ?? parseEmailTemplates(config.emailTemplates)[key]?.published ?? defaultEmailTemplate(key);
  const rendered = renderEmailTemplate(template, { storeName: store.displayName, logoUrl: store.logoUrl, origin, customerName: input.customerName, subject: input.subject, message: input.text, fields: input.templateFields });
  const prepared = input.prepared ?? { ...rendered, sender: currentSender };
  if (!input.prepared && input.onPrepared) await input.onPrepared(prepared);
  const { subject, text, html, sender } = prepared;
  if (email.mode === "mock") {
    if (email.testOutboxPath) {
      await appendFile(email.testOutboxPath, `${JSON.stringify({ ...input, subject, text, html, from: sender.from, attachments: input.attachments?.map(({ filename, content }) => ({ filename, size: content.length })), createdAt: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
    }
    logEvent("info", "email_mocked", { messageType: input.subject, recipientDomain: input.to.split("@")[1] ?? "invalid" });
    return false;
  }
  if (!email.webhookUrl || (email.provider !== "resend" && !email.webhookSecret)) throw new Error("Email provider is not configured");
  if (email.provider === "mailtrap-sandbox") {
    if (!email.webhookSecret) throw new Error("Email provider is not configured");
    // Mailtrap captures the same print attachment without delivering to a real inbox.
    if (!sender.address) throw new Error("Mailtrap Sandbox sender is not configured");
    const response = await fetch(email.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "Api-Token": email.webhookSecret },
      body: JSON.stringify({ from: { email: sender.address, ...(sender.name ? { name: sender.name } : {}) }, to: [{ email: input.to }], subject, text, html, ...(input.attachments?.length ? { attachments: input.attachments.map(({ filename, content }) => ({ filename, content: content.toString("base64"), type: "model/3mf", disposition: "attachment" })) } : {}) }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!response.ok || (await response.json() as { success?: boolean }).success !== true) throw new Error("Email delivery failed");
    return true;
  }
  if (email.provider === "resend") {
    const fromAddress = sender.from;
    const secret = Object.hasOwn(email.resendStores, input.storeSlug) ? email.resendStores[input.storeSlug].apiKey : undefined;
    if (!fromAddress || !secret) throw new Error("Resend sender is not configured for store");
    const response = await fetch(email.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}`, ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}) },
      body: JSON.stringify({ from: fromAddress, to: [input.to], subject, text, html, ...(input.attachments?.length ? { attachments: input.attachments.map(({ filename, content }) => ({ filename, content: content.toString("base64") })) } : {}) }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Email delivery failed");
    return true;
  }
  const response = await fetch(email.webhookUrl, { method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${email.webhookSecret}`, ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})}, body:JSON.stringify({ ...input, subject, text, html, from: sender.from, environment: appEnv, mode: email.mode }), signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw new Error("Email delivery failed");
  return true;
}
