import { availableGiftChoices } from "@/lib/gift-variants";
import { jsonFieldError, jsonValidationError } from "@/lib/admin-validation-feedback";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAdminApiContext, canManageStore } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
const schema = z
  .object({
    categoryId: z.string().uuid(),
    giftProductId: z.string().uuid().nullable().optional(),
    giftName: z.string().trim().min(1).max(120),
    limit: z.number().int().min(1).max(100000),
    active: z.boolean(),
    restart: z.boolean().default(false),
  })
  .strict();
export async function PUT(request: NextRequest) {
  if (!assertSameOrigin(request))
    return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext("content.write");
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonValidationError(parsed.error);
if (
    !(await db.productCategory.count({
      where: { id: parsed.data.categoryId, storeId: context!.store.id },
    }))
  )
    return jsonError("Category not found in this store", 404);
  if (parsed.data.active && parsed.data.giftProductId === null) return jsonFieldError("giftProductId", "Select the actual gift product before activating this campaign.");
  if (parsed.data.giftProductId) {
    const product = await db.product.findFirst({ where: { id: parsed.data.giftProductId, storeId: context!.store.id, status: "ACTIVE" }, include: { variants: { where: { active: true } }, options: { where: { type: "COLOUR", active: true }, take: 1, include: { values: { where: { active: true } } } } } });
    if (!product || !availableGiftChoices(product).length) return jsonFieldError("giftProductId", "Choose a gift product with an available colour and stock or a made-to-order production time.");
  }
  try {
    await db.$transaction(
      async (tx) => {
        const key = { storeId: context!.store.id, key: "launch-stands" };
        const current = await tx.giftCampaign.findUnique({
          where: { storeId_key: key },
        });
        const { restart, ...data } = parsed.data;
        if (
          current &&
          !restart &&
          (current.awardedCount > data.limit ||
            (data.active && current.awardedCount >= data.limit))
        )
          throw new Error("LIMIT_REACHED");
        await tx.giftCampaign.upsert({
          where: { storeId_key: key },
          create: { ...key, ...data, name: "Launch gift" },
          update: {
            ...data,
            ...(restart ? { awardedCount: 0, cycle: { increment: 1 } } : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: context!.user.id,
            storeId: context!.store.id,
            action: restart
              ? "GIFT_CAMPAIGN_RESTARTED"
              : "GIFT_CAMPAIGN_UPDATED",
            entityType: "GiftCampaign",
            metadata: { ...data, restart },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "LIMIT_REACHED")
      return jsonError(
        "The limit has been reached. Increase it or explicitly start a new campaign cycle.",
        409,
      );
    throw error;
  }
  return NextResponse.json({ ok: true });
}
