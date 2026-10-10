import { supportConfigSchema } from "@/lib/support-config";
import { loyaltyConfigSchema } from "@/lib/loyalty-config";
import { z } from "zod";
import { emailSendersSchema } from "@/lib/email-senders";
export const accountConfigSchema=z.object({loyalty:loyaltyConfigSchema.catch(() => ({ ...loyaltyConfigSchema.parse({}), enabled: false })).optional(),support:supportConfigSchema.optional(),emailSenders:emailSendersSchema.optional(),googleEnabled:z.boolean().default(true),appleEnabled:z.boolean().default(false),favouritesEnabled:z.boolean().default(true),savedCartEnabled:z.boolean().default(true),notificationsEnabled:z.boolean().default(true),helpEnabled:z.boolean().default(true),helpText:z.string().trim().max(300).default("Tell us how we can help with your order. Requests are reviewed by our team."),requestTopics:z.array(z.enum(["ORDER_CHANGE","ADDRESS_CHANGE","CANCELLATION_REQUEST","DELIVERY","QUALITY","GENERAL","PRIVACY","ACCOUNT","OTHER"])).default(["ORDER_CHANGE","ADDRESS_CHANGE","CANCELLATION_REQUEST","DELIVERY","QUALITY","GENERAL","PRIVACY","ACCOUNT","OTHER"])});
export type AccountConfig=z.infer<typeof accountConfigSchema>;
export function parseAccountConfig(value:unknown):AccountConfig {const parsed=accountConfigSchema.safeParse(value);return parsed.success?parsed.data:accountConfigSchema.parse({});}
