import { z } from "zod";

// Public settings only. Provider credentials never belong in this document.
export const integrationConfigSchema = z.object({
  geoapifyEnabled: z.boolean().default(false),
  rememberCheckoutEnabled: z.boolean().default(true),
  rememberCheckoutDays: z.number().int().min(1).max(90).default(90),
  analyticsEnabled: z.boolean().default(false),
  clarityEnabled: z.boolean().default(false),
  metaPixelEnabled: z.boolean().default(false),
  metaCapiEnabled: z.boolean().default(false),
  metaCatalogEnabled: z.boolean().default(false),
  ga4MeasurementId: z.string().trim().regex(/^(G-[A-Z0-9]{6,20})?$/).default(""),
  clarityProjectId: z.string().trim().regex(/^[a-z0-9]{0,40}$/i).default(""),
  metaPixelId: z.string().trim().regex(/^[0-9]{0,30}$/).default(""),
  metaCatalogId: z.string().trim().regex(/^[0-9]{0,30}$/).default(""),
}).strict();
export type IntegrationConfig = z.infer<typeof integrationConfigSchema>;
export function parseIntegrationConfig(value: unknown): IntegrationConfig {
  const parsed = integrationConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : integrationConfigSchema.parse({});
}

export const geoapifyStoresSchema = z.preprocess(value => {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}, z.record(z.string().regex(/^[a-z0-9-]+$/), z.object({ apiKey: z.string().trim().min(8).max(200) }).strict()));
