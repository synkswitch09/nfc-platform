import { z } from "zod";

export const packageFields = z.object({
  name: z.string().trim().min(2).max(100), lengthMm: z.number().int().min(1).max(1000),
  widthMm: z.number().int().min(1).max(1000), heightMm: z.number().int().min(0).max(1000),
  emptyWeightGrams: z.number().int().min(0).max(30_000), maxWeightGrams: z.number().int().min(1).max(30_000).nullable(),
  active: z.boolean(),
});
