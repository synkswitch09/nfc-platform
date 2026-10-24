import { z } from "zod";
import type { Prisma } from "@prisma/client";
export const reviewSchema = z
  .object({
    orderItemId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    displayName: z.string().trim().min(1).max(60),
    body: z.string().trim().min(10).max(2000),
  })
  .strict();
export const reviewableOrderStatuses = [
  "PAID",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
] as const;
export const paidReviewOrder: Prisma.OrderWhereInput = {
  status: { in: [...reviewableOrderStatuses] },
  payments: { some: { status: "SUCCEEDED" } },
};
