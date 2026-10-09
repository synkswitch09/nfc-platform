import { z } from "zod";

export const emailCategories = ["default", "orders", "account", "promotions", "support"] as const;
export type EmailCategory = typeof emailCategories[number];
const senderSchema = z.object({
  address: z.union([z.literal(""), z.email().max(254)]).transform(value => value.toLowerCase()),
  name: z.string().trim().max(80).refine(value => !/[\r\n<>]/.test(value), "Use a plain sender name"),
}).strict();
export const emailSendersSchema = z.object({ default: senderSchema, orders: senderSchema, account: senderSchema, promotions: senderSchema, support: senderSchema }).strict();
export type EmailSenders = z.infer<typeof emailSendersSchema>;

export function senderDomain(address: string) { return address.split("@")[1]?.toLowerCase() ?? ""; }
export function storeSendingDomain(domains: { hostname: string; environment: string; isPrimary: boolean }[]) {
  const primary = domains.find(domain => domain.environment === "PRODUCTION" && domain.isPrimary) ?? domains.find(domain => domain.isPrimary);
  return primary?.hostname.toLowerCase().replace(/^(?:staging|develop|development|www)\./, "") ?? "";
}
export function defaultStoreSender(domains: { hostname: string; environment: string; isPrimary: boolean }[]) {
  const domain = storeSendingDomain(domains);
  return domain ? `hello@${domain}` : "";
}
export function parseEmailSenders(value: unknown, fallbackAddress: string, storeName: string): EmailSenders {
  const parsed = emailSendersSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const domain = senderDomain(fallbackAddress);
  return {
    default: { address: fallbackAddress, name: storeName },
    orders: { address: domain ? `orders@${domain}` : "", name: `${storeName} Orders` },
    account: { address: domain ? `accounts@${domain}` : "", name: `${storeName} Accounts` },
    promotions: { address: domain ? `promotions@${domain}` : "", name: storeName },
    support: { address: domain ? `support@${domain}` : "", name: `${storeName} Support` },
  };
}
export function resolveEmailSender(senders: EmailSenders, category: EmailCategory, fallbackAddress: string) {
  const selected = senders[category];
  const address = selected.address || senders.default.address || fallbackAddress;
  const name = selected.name || senders.default.name;
  if (!address || senderDomain(address) !== senderDomain(fallbackAddress)) throw new Error("Sender must use the store's configured sending domain");
  const display = /[,"\\]/.test(name) ? `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"` : name;
  return { address, name, from: display ? `${display} <${address}>` : address };
}
export function orderEmailCategory(dedupeKey: string | null): EmailCategory {
  if (dedupeKey?.startsWith("support:")) return "support";
  if (dedupeKey?.startsWith("next-purchase:")) return "promotions";
  return "orders";
}
export function ticketSupportFooter(origin?: string) {
  return `\n\nThis is an automated email. Replies to this address are not monitored. For support, open a ticket under Help & requests. Sign in or verify your email to use support without an account.${origin ? `\n${origin}/support` : ""}`;
}
