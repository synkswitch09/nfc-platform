import { z } from "zod";

export const supportTopics = ["ORDER_CHANGE", "ADDRESS_CHANGE", "CANCELLATION_REQUEST", "DELIVERY", "QUALITY", "GENERAL", "PRIVACY", "ACCOUNT", "OTHER"] as const;
export const supportConfigSchema = z.object({
  guestEnabled: z.boolean().default(true),
  firstResponseBusinessDays: z.number().int().min(1).max(30).default(5),
  autoPause: z.boolean().default(true),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), "Use a valid date")).max(100).default([]),
  notificationEmails: z.array(z.string().trim().email().max(254)).max(5).default([]),
});
export type SupportConfig = z.infer<typeof supportConfigSchema>;
export function parseSupportConfig(accountConfig: unknown): SupportConfig {
  const value = accountConfig && typeof accountConfig === "object" && !Array.isArray(accountConfig) ? (accountConfig as Record<string, unknown>).support : undefined;
  const result = supportConfigSchema.safeParse(value ?? {});
  return result.success ? result.data : supportConfigSchema.parse({});
}

// Calendar dates in the store timezone, excluding weekends and CMS holidays.
// Noon UTC is only a date cursor; the final instant is 17:00 in the store timezone.
export function responseDeadline(now: Date, days: number, timezone: string, holidays: string[] = []) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const cursor = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (![0, 6].includes(cursor.getUTCDay()) && !holidays.includes(cursor.toISOString().slice(0, 10))) remaining--;
  }
  const localTarget = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), 17);
  let instant = localTarget;
  const clock = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let n = 0; n < 3; n++) {
    const fields = Object.fromEntries(clock.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const rendered = Date.UTC(+fields.year, +fields.month - 1, +fields.day, +fields.hour, +fields.minute, +fields.second);
    instant += localTarget - rendered;
  }
  return new Date(instant);
}
export function canPauseBeforePreparation(order: { status: string; preparationStartedAt?: Date | null; items: { packedQuantity: number; manufacturingJobs: { status: string; startedAt: Date | null }[] }[] }) {
  return order.status === "PAID" && !order.preparationStartedAt && order.items.every(item => item.packedQuantity === 0 && item.manufacturingJobs.every(job => job.status === "QUEUED" && !job.startedAt));
}
