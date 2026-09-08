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
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const activationSchema = z.object({
  publicTagId: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8,24}$/),
  activationCode: z.string().trim().toUpperCase().regex(/^[A-Z2-9-]{10,32}$/),
});

export const checkoutSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
    personalisation: z.record(z.string(), z.string().trim().max(80)).optional(),
  })).min(1).max(20),
});
