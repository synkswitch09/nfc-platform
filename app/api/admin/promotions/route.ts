import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export const promotionSchema = z.object({ name: z.string().trim().min(3).max(100), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/).nullable(), kind: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]), percent: z.number().int().min(1).max(90).nullable(), amountCents: z.number().int().min(1).max(100000).nullable(), productId: z.string().uuid().nullable(), minimumSubtotalCents: z.number().int().min(0).max(10000000), maxShippingDiscountCents: z.number().int().min(1).max(100000).nullable(), maxShippingWeightGrams: z.number().int().min(1).max(50000).nullable(), usageLimit: z.number().int().min(1).max(100000).nullable(), startsAt: z.coerce.date().nullable(), endsAt: z.coerce.date().nullable(), active: z.boolean() }).superRefine((value, context) => {
  if (value.kind === "PERCENT" && !value.percent || value.kind === "FIXED" && !value.amountCents) context.addIssue({ code: "custom", message: "Enter a percent or fixed amount" });
  if (value.startsAt && value.endsAt && value.startsAt >= value.endsAt) context.addIssue({ code: "custom", message: "End date must follow start date" });
});

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = promotionSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid promotion", 400);
  if (parsed.data.productId && !await db.product.count({ where: { id: parsed.data.productId, storeId: context!.store.id } })) return jsonError("Product belongs to another store", 409);
  try {
    const promotion = await db.promotion.create({ data: { ...parsed.data, storeId: context!.store.id } });
    return NextResponse.json({ promotion }, { status: 201 });
  } catch { return jsonError("Code already exists in this store", 409); }
}
