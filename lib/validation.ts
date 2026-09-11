import { z } from "zod";

export const passwordSchema = z.string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  orderNumber: z.string().trim().regex(/^TK-[A-Z0-9]{10}$/).optional(),
  orderClaimToken: z.string().min(32).max(200).optional(),
}).refine(value => Boolean(value.orderNumber) === Boolean(value.orderClaimToken), {
  message: "Order claim details are incomplete",
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const activationSchema = z.object({
  publicTagId: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8,24}$/),
  activationCode: z.string().trim().toUpperCase().regex(/^[A-Z2-9-]{10,32}$/),
});

export const checkoutItemsSchema = z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
    personalisationChoice: z.enum(["BASIC", "PERSONALISED"]).optional(),
    personalisation: z.record(z.string(), z.string().trim().max(80)).optional(),
  })).min(1).max(20);

export const shippingAddressSchema = z.object({
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  suburb: z.string().trim().min(2).max(80),
  state: z.enum(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]),
  postcode: z.string().trim().regex(/^\d{4}$/),
  country: z.literal("AU").default("AU"),
});

export const shippingQuoteSchema = z.object({
  items: checkoutItemsSchema,
  destination: shippingAddressSchema,
});

export const checkoutSchema = z.object({
  items: checkoutItemsSchema,
  shippingQuoteToken: z.string().min(32).max(200),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    shipping: shippingAddressSchema,
  }).optional(),
});
