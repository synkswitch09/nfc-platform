import { z } from "zod";

export const pickupConfigSchema = z.object({
  enabled: z.boolean().default(false),
  suburb: z.string().trim().max(120).default(""),
  address: z.string().trim().max(500).default(""),
  instructions: z.string().trim().max(1500).default(""),
  hours: z.string().trim().max(500).default(""),
}).superRefine((value, ctx) => {
  if (!value.enabled) return;
  for (const field of ["suburb", "address", "hours"] as const) if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message: `Enter pickup ${field === "hours" ? "hours or appointment arrangements" : field} before enabling local pickup.` });
});
export type PickupConfig = z.infer<typeof pickupConfigSchema>;
export function parsePickupConfig(value: unknown): PickupConfig {
  const parsed = pickupConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : { enabled: false, suburb: "", address: "", hours: "", instructions: "" };
}
/** Only these fields may be passed to public checkout clients. */
export function publicPickupConfig(value: unknown) {
  const { enabled, suburb } = parsePickupConfig(value);
  return { enabled, suburb };
}
export function pickupReadyText(value: unknown, orderNumber: string) {
  const pickup = parsePickupConfig(value);
  if (!pickup.address) throw new Error("Pickup instructions are missing from this order. Contact support before marking it ready.");
  return [`Your order ${orderNumber} is ready for pickup.`, `Pickup address: ${pickup.address}`, `Hours / appointment arrangements: ${pickup.hours}`, pickup.instructions, `Map: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.address)}`, `Please bring your order number ${orderNumber}. Collect only during the stated hours or after confirming your appointment.`].filter(Boolean).join("\n\n");
}
