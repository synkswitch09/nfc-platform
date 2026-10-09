import { z } from "zod";
import { isSafeImageSource } from "@/lib/image-source";
import { ticketSupportFooter } from "@/lib/email-senders";

export const emailTemplateKeys = ["verification", "password-reset", "security", "team-invitation", "payment", "shipped", "delivered", "dispatch-estimate", "refund", "support", "reward", "operations", "default"] as const;
export type EmailTemplateKey = typeof emailTemplateKeys[number];
export const emailTemplateLabels: Record<EmailTemplateKey, string> = {
  verification: "Email verification", "password-reset": "Password reset", security: "Account security", "team-invitation": "Team invitation",
  payment: "Payment confirmation", shipped: "Order shipped", delivered: "Order delivered", "dispatch-estimate": "Dispatch estimate", refund: "Refund confirmation",
  support: "Support update", reward: "Next purchase reward", operations: "Operations / print files", default: "Other notifications",
};
const copy = z.string().max(3000);
const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: copy }).strict(),
  z.object({ type: z.literal("text"), text: copy }).strict(),
  z.object({ type: z.literal("image"), url: z.string().max(2048).min(1).refine(isSafeImageSource, "Use an uploaded image or HTTPS URL"), alt: z.string().max(200) }).strict(),
  z.object({ type: z.literal("button"), text: z.string().min(1).max(120), url: z.string().min(1).max(2048) }).strict(),
  z.object({ type: z.literal("divider") }).strict(),
]);
export const emailTemplateSchema = z.object({
  subject: z.string().min(1).max(250).refine(value => !/[\r\n]/.test(value), "Subject must be a single line"),
  preheader: z.string().max(250), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), blocks: z.array(blockSchema).max(24),
}).strict();
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
export type EmailBlock = EmailTemplate["blocks"][number];
const entrySchema = z.object({ draft: emailTemplateSchema, published: emailTemplateSchema.nullable(), revision: z.number().int().nonnegative(), updatedAt: z.string(), publishedAt: z.string().nullable() }).strict();
export type EmailTemplateEntry = z.infer<typeof entrySchema>;
export type EmailTemplates = Partial<Record<EmailTemplateKey, EmailTemplateEntry>>;
const commonTokens = ["store.name", "store.url", "store.helpUrl", "customer.name", "email.subject"];
export function templateTokens(key: EmailTemplateKey) {
  return [...commonTokens, ...(["verification"].includes(key) ? ["account.code"] : []), ...(["password-reset", "team-invitation"].includes(key) ? ["account.actionUrl"] : []), ...(["payment", "shipped", "delivered", "dispatch-estimate", "refund", "support", "reward", "operations"].includes(key) ? ["order.number"] : [])];
}
export function safeEmailUrl(value: string, origin?: string) {
  try {
    // Only known media paths are resolved relative to the current store, never protocol-relative URLs.
    const relative = value.startsWith("/api/media/") || value.startsWith("/images/");
    if (relative && (!origin || !isSafeImageSource(value))) return null;
    const url = relative ? new URL(value, origin) : new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return url.href;
  } catch { /* Invalid links are omitted. */ }
  return null;
}
export function validateEmailTemplate(key: EmailTemplateKey, input: unknown) {
  const parsed = emailTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid template" };
  const template = parsed.data;
  const strings = [template.subject, template.preheader, ...template.blocks.flatMap(block => block.type === "divider" ? [] : block.type === "image" ? [block.alt] : block.type === "button" ? [block.text, block.url] : [block.text])];
  const allowed = templateTokens(key);
  for (const value of strings) {
    const tokens = [...value.matchAll(/{{\s*([^{}]+?)\s*}}/g)];
    if (tokens.some(token => !allowed.includes(token[1].trim())) || /[{}]/.test(value.replace(/{{\s*([^{}]+?)\s*}}/g, ""))) return { success: false as const, error: "Unknown or incomplete dynamic field. Use the fields listed for this template." };
  }
  if (template.blocks.some(block => block.type === "button" && !safeEmailUrl(block.url) && !["{{store.url}}", "{{store.helpUrl}}", ...(["password-reset", "team-invitation"].includes(key) ? ["{{account.actionUrl}}"] : [])].includes(block.url))) return { success: false as const, error: "Buttons need an HTTPS URL or a listed URL field." };
  return { success: true as const, data: template };
}
export function defaultEmailTemplate(key: EmailTemplateKey): EmailTemplate {
  const introductions: Record<EmailTemplateKey, string> = {
    verification: "Welcome to {{store.name}}. Please verify your email to finish setting up your account.",
    "password-reset": "We received a request to reset your password. Follow the instructions below if this was you.",
    security: "There has been an update to your account security.", "team-invitation": "You have been invited to help manage {{store.name}}.",
    payment: "Thank you for your purchase, {{customer.name}}. Here is the latest update for your order.",
    shipped: "Your order is on its way, {{customer.name}}. Your tracking details are below.", delivered: "Your order has been marked as delivered. Thank you for choosing {{store.name}}.",
    "dispatch-estimate": "Here is an update to the dispatch estimate for your order.", refund: "Here is an update about your refund.",
    support: "Our team has an update about your order request.", reward: "Thank you for shopping with {{store.name}}. Your next purchase offer is below.",
    operations: "A paid order is ready for review. Check the order details and any production attachments below.", default: "Here is the latest update from {{store.name}}.",
  };
  return { subject: "{{email.subject}}", preheader: "An update from {{store.name}}", accent: "#284B63", blocks: [{ type: "heading", text: "{{email.subject}}" }, { type: "text", text: introductions[key] }] };
}
export function parseEmailTemplates(value: unknown): EmailTemplates {
  const result: EmailTemplates = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const key of emailTemplateKeys) {
    const parsed = entrySchema.safeParse((value as Record<string, unknown>)[key]);
    if (parsed.success && validateEmailTemplate(key, parsed.data.draft).success && (!parsed.data.published || validateEmailTemplate(key, parsed.data.published).success)) result[key] = parsed.data;
  }
  return result;
}
export function getEmailTemplateEntry(templates: EmailTemplates, key: EmailTemplateKey): EmailTemplateEntry {
  return templates[key] ?? { draft: defaultEmailTemplate(key), published: null, revision: 0, updatedAt: "", publishedAt: null };
}
export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
function substitute(value: string, data: Record<string, string>) { return value.replace(/{{\s*([^{}]+?)\s*}}/g, (_, key: string) => data[key.trim()] ?? ""); }
function paragraphs(value: string) {
  return escapeEmailHtml(value).replace(/\n/g, "<br />");
}
export type EmailTemplateData = { storeName: string; origin?: string; logoUrl?: string | null; customerName?: string | null; subject: string; message: string; fields?: Record<string, string> };
export function renderEmailTemplate(template: EmailTemplate, input: EmailTemplateData) {
  const fields = { ...input.fields, "store.name": input.storeName, "store.url": input.origin ?? "", "store.helpUrl": input.origin ? `${input.origin}/dashboard/help` : "", "customer.name": input.customerName?.trim() || "there", "email.subject": input.subject };
  const subject = substitute(template.subject, fields).replace(/[\r\n]+/g, " ").slice(0, 300) || input.subject.replace(/[\r\n]+/g, " ");
  const htmlBlocks: string[] = [];
  const textBlocks: string[] = [];
  for (const block of template.blocks) {
    if (block.type === "divider") { htmlBlocks.push('<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />'); continue; }
    if (block.type === "image") {
      const url = safeEmailUrl(block.url, input.origin);
      if (url) htmlBlocks.push(`<img src="${escapeEmailHtml(url)}" alt="${escapeEmailHtml(substitute(block.alt, fields))}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:20px 0" />`);
      continue;
    }
    const text = substitute(block.text, fields);
    if (block.type === "button") {
      const url = safeEmailUrl(substitute(block.url, fields));
      if (url) { htmlBlocks.push(`<p style="margin:24px 0"><a href="${escapeEmailHtml(url)}" style="display:inline-block;background:${template.accent};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold">${escapeEmailHtml(text)}</a></p>`); textBlocks.push(`${text}: ${url}`); }
    } else {
      htmlBlocks.push(block.type === "heading" ? `<h1 style="color:${template.accent};font-size:24px;line-height:1.4;margin:0 0 20px;overflow-wrap:anywhere">${paragraphs(text)}</h1>` : `<p style="margin:0 0 20px;line-height:1.7;overflow-wrap:anywhere">${paragraphs(text)}</p>`);
      textBlocks.push(text);
    }
  }
  const logo = input.logoUrl ? safeEmailUrl(input.logoUrl, input.origin) : null;
  const actionUrl = input.fields?.["account.actionUrl"] ? safeEmailUrl(input.fields["account.actionUrl"]) : null;
  const footer = ticketSupportFooter(input.origin);
  // Mandatory transaction facts and auth instructions never come from editable CMS content.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeEmailHtml(subject)}</title></head><body style="margin:0;background:#f3f5f7;color:#243441;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(substitute(template.preheader, fields))}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px"><tr><td style="padding:32px;word-break:break-word">${logo ? `<img src="${escapeEmailHtml(logo)}" alt="${escapeEmailHtml(input.storeName)}" width="160" style="display:block;max-width:160px;height:auto;margin-bottom:28px;border:0" />` : `<p style="font-size:20px;font-weight:bold;color:${template.accent};margin:0 0 28px">${escapeEmailHtml(input.storeName)}</p>`}${htmlBlocks.join("")}<div style="border-left:3px solid ${template.accent};padding:16px;background:#f8fafc;line-height:1.7;overflow-wrap:anywhere">${paragraphs(input.message)}</div>${actionUrl ? `<p style="margin:24px 0"><a href="${escapeEmailHtml(actionUrl)}" style="color:${template.accent};font-weight:bold">${input.fields?.["account.actionLabel"] ? escapeEmailHtml(input.fields["account.actionLabel"]) : "Continue securely"}</a></p>` : ""}<p style="font-size:12px;line-height:1.7;color:#586575;overflow-wrap:anywhere">${paragraphs(footer)}${input.origin ? `<br /><a href="${escapeEmailHtml(`${input.origin}/dashboard/help`)}" style="color:${template.accent}">Help &amp; requests</a>` : ""}</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text: [...textBlocks.filter(Boolean), input.message].join("\n\n") + footer };
}
export function sampleEmailData(key: EmailTemplateKey, storeName: string, origin: string, logoUrl?: string | null): EmailTemplateData {
  const samples: Record<EmailTemplateKey, string> = {
    verification: "Your verification code is 123456. It expires in 10 minutes. If you did not create this account, you can ignore this email.",
    "password-reset": `Reset your password: ${origin}/reset-password?token=preview-only`, security: "Your account password was updated. Other sessions were signed out. If this was not you, reset your password immediately.",
    "team-invitation": `You are invited to manage ${storeName}: ${origin}/dashboard/team-invitation?token=preview-only\nThis invitation expires in 7 days.`,
    payment: "Payment has been received for order DEMO-1001. We will let you know when your order progresses.", shipped: "Your order has shipped. Parcels: Example carrier: DEMO-TRACKING.", delivered: "All parcels in your order have been marked as delivered by the carrier. If you need help, open a ticket in your account.",
    "dispatch-estimate": "The estimated dispatch date for order DEMO-1001 has been updated. We will email tracking when it ships.", refund: "A refund of 25.00 AUD has been confirmed by the payment provider. Your bank determines when it appears in your account.", support: "We have reviewed your order request. You can view the update under Help & requests in your account.", reward: "Use code DEMO-REWARD on your next purchase within the validity period. This is an example and is not redeemable.", operations: "Payment has been received for DEMO-1001. Production files, when applicable, are attached to the real notification.", default: "This is a sample notification. No account or order has been changed.",
  };
  return { storeName, origin, logoUrl, customerName: "Alex", subject: `${storeName}: ${emailTemplateLabels[key]}`, message: samples[key], fields: { "account.code": "123456", "account.actionUrl": key === "team-invitation" ? `${origin}/dashboard/team-invitation?token=preview-only` : `${origin}/reset-password?token=preview-only`, "order.number": "DEMO-1001" } };
}
export function orderNoticeTemplate(key?: string, subject?: string, operations = false): EmailTemplateKey {
  if (operations) return "operations";
  if (key?.startsWith("paid:")) return "payment";
  if (key?.startsWith("refund:")) return "refund";
  if (key?.startsWith("support:")) return "support";
  if (key?.startsWith("next-purchase:")) return "reward";
  if (key?.startsWith("production-date:")) return "dispatch-estimate";
  if (key?.startsWith("delivered:")) return "delivered";
  if (key?.startsWith("status:") && subject?.endsWith("Your order has shipped")) return "shipped";
  return "default";
}

// Stored on durable notices before contacting the provider; retries keep the same body and sender.
export const preparedEmailSchema = z.object({ subject: z.string(), text: z.string(), html: z.string(), sender: z.object({ address: z.string(), name: z.string(), from: z.string() }) });
export type PreparedEmail = z.infer<typeof preparedEmailSchema>;
