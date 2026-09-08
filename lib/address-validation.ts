import { z } from "zod";

export const addressSchema = z.object({ label: z.string().trim().max(40).optional(), recipient: z.string().trim().min(2).max(100), line1: z.string().trim().min(3).max(120), line2: z.string().trim().max(120).optional(), suburb: z.string().trim().min(2).max(80), state: z.enum(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]), postcode: z.string().regex(/^\d{4}$/), country: z.literal("AU") });
