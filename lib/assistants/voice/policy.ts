import { z } from "zod";
import { contactSchema } from "../growth/schema";
import { AssistantError } from "../http";
import { providerId } from "./provider";
export const voiceSettingsSchema = z
  .object({
    phoneNumberId: providerId,
    enabled: z.boolean(),
    monthlyMinuteLimit: z.number().int().min(0).max(10000),
    legalReviewUntil: z.string().datetime(),
    holidayCalendarUntil: z.iso.date(),
    holidays: z.array(z.iso.date()).max(200),
    reviewEvidence: z.string().trim().min(10).max(2000),
  })
  .strict();
export function assertMarketingConsent(
  contact: z.infer<typeof contactSchema>,
  channel: "CHAT" | "VOICE",
  now = new Date(),
) {
  const consent = contact.consent,
    at = consent.at ? Date.parse(consent.at) : NaN,
    expiry = consent.expiresAt
      ? Date.parse(consent.expiresAt)
      : at + 90 * 86400000;
  if (
    contact.optedOut ||
    ![channel, "BOTH"].includes(consent.channel) ||
    consent.evidence.trim().length < 10 ||
    !Number.isFinite(at) ||
    at > now.getTime() ||
    expiry <= now.getTime()
  )
    throw new AssistantError(
      "Current, documented permission for this contact method is required.",
    );
}
/** Conservative opt-in callbacks: local weekdays 09–17, verified calendar and review. */
export function assertCallbackEligible(
  contact: z.infer<typeof contactSchema>,
  settings: z.infer<typeof voiceSettingsSchema>,
  now = new Date(),
) {
  if (!settings.enabled || settings.monthlyMinuteLimit < 1)
    throw new AssistantError("Calls are paused or have no budget.", 409);
  if (new Date(settings.legalReviewUntil) <= now)
    throw new AssistantError(
      "Renew the business compliance review before calling.",
      409,
    );
  if (
    !["AU", "CO"].includes(contact.country) ||
    !(contact.country === "AU"
      ? contact.phone.startsWith("+61")
      : contact.phone.startsWith("+57"))
  )
    throw new AssistantError(
      "Calling requires a verified Australian or Colombian contact location.",
    );
  if (
    (contact.country === "CO" && contact.timeZone !== "America/Bogota") ||
    (contact.country === "AU" && !contact.timeZone.startsWith("Australia/"))
  )
    throw new AssistantError("Confirm the contact's local time zone first.");
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: contact.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now),
    value = (type: string) => parts.find((p) => p.type === type)?.value || "",
    day = `${value("year")}-${value("month")}-${value("day")}`;
  if (
    day > settings.holidayCalendarUntil ||
    settings.holidays.includes(day) ||
    ["Sat", "Sun"].includes(value("weekday")) ||
    Number(value("hour")) < 9 ||
    Number(value("hour")) >= 17
  )
    throw new AssistantError(
      "Outside approved local business hours or holiday calendar coverage.",
      409,
    );
  assertMarketingConsent(contact, "VOICE", now);
}
