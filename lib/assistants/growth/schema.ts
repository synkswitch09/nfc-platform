import { z } from "zod";
export const language = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .refine((v) => {
    try {
      return Intl.getCanonicalLocales(v).length === 1;
    } catch {
      return false;
    }
  }, "Choose a language such as en-AU or es-CO.");
export const country = z.string().regex(/^[A-Z]{2}$/);
export const timeZone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v }).format();
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone.");
export const localeSchema = z
  .object({ preferredLanguage: language, preferredCountry: country, timeZone })
  .strict();
const text = z.string().trim().max(12000),
  iso = z.string().datetime();
export const contactSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.union([z.email(), z.literal("")]).default(""),
    phone: z
      .union([z.string().regex(/^\+[1-9]\d{6,14}$/), z.literal("")])
      .default(""),
    country: country.default("AU"),
    language: language.default("en"),
    timeZone: timeZone.default("Australia/Adelaide"),
    stage: z
      .enum(["NEW", "QUALIFIED", "FOLLOW_UP", "WON", "LOST"])
      .default("NEW"),
    notes: text.default(""),
    nextAction: z.string().max(500).default(""),
    nextActionAt: iso.nullable().default(null),
    consent: z
      .object({
        channel: z.enum(["NONE", "CHAT", "VOICE", "BOTH"]),
        evidence: z.string().max(2000),
        at: iso.nullable(),
        expiresAt: iso.nullable(),
      })
      .default({ channel: "NONE", evidence: "", at: null, expiresAt: null }),
    optedOut: z.boolean().default(false),
    conversationId: z.uuid().nullable().default(null),
    outcomeEvidence: z.string().max(2000).default(""),
  })
  .strict()
  .refine((v) => v.stage !== "WON" || v.outcomeEvidence.trim().length > 0, {
    message: "Record an order or business confirmation before marking a sale.",
    path: ["outcomeEvidence"],
  });
export const campaignSchema = z
  .object({
    objective: z.string().trim().min(3).max(1000),
    offer: text.default(""),
    instructions: text.default(""),
    audience: z.string().max(2000).default(""),
    greeting: z.string().max(1000).default(""),
    questions: text.default(""),
    objections: text.default(""),
    boundaries: text.default(""),
    preferredLanguage: language.default("en"),
    preferredCountry: country.default("AU"),
    timeZone: timeZone.default("Australia/Adelaide"),
    channel: z.enum(["CHAT", "VOICE"]).default("CHAT"),
    contactIds: z.array(z.uuid()).max(500).default([]),
    maxCalls: z.number().int().min(0).max(1000).default(0),
    voiceId: z.string().max(100).default(""),
    bookingUrl: z
      .union([z.url().startsWith("https://"), z.literal("")])
      .default(""),
  })
  .strict();
export const contentSchema = z
  .object({
    format: z.enum(["POST", "CAROUSEL", "REEL", "STORY"]),
    channel: z.enum(["INSTAGRAM", "FACEBOOK"]),
    brief: text,
    caption: text.default(""),
    script: text.default(""),
    mediaUrls: z.array(z.url().startsWith("https://")).max(10).default([]),
    video: z.boolean().default(false),
    scheduledAt: iso.nullable().default(null),
    timeZone: timeZone.default("Australia/Adelaide"),
    sources: z
      .array(z.object({ url: z.url().startsWith("https://"), checkedAt: iso }))
      .max(20)
      .default([]),
  })
  .strict();
export const taskSchema = z
  .object({
    description: text.default(""),
    dueAt: iso.nullable().default(null),
    done: z.boolean().default(false),
    contactId: z.uuid().nullable().default(null),
  })
  .strict();
export const schemas = {
  CONTACT: contactSchema,
  CAMPAIGN: campaignSchema,
  CONTENT: contentSchema,
  TASK: taskSchema,
};
export const resourceInput = z
  .object({
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    kind: z.enum(["CONTACT", "CAMPAIGN", "CONTENT", "TASK"]),
    title: z.string().trim().min(1).max(120),
    data: z.unknown(),
  })
  .strict();
export function parseResource(kind: keyof typeof schemas, data: unknown) {
  return schemas[kind].parse(data);
}
export function languageInstructions(v: {
  preferredLanguage?: string;
  preferredCountry?: string;
}) {
  return `Preferred language: ${v.preferredLanguage || "en"}. Business market: ${v.preferredCountry || "AU"}. Start in that language when the customer has not expressed a language. Otherwise respond in the language of their latest message and switch when asked. Do not infer citizenship or permission from language. Preserve names, URLs, order identifiers and prices. If you cannot reliably understand a language, ask for clarification or offer a human.`;
}
