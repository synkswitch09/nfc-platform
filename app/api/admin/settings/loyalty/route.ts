import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { loyaltyConfigSchema, parseLoyaltyConfig } from "@/lib/loyalty-config";
import { adjustLoyalty, LoyaltyError } from "@/lib/loyalty";
export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid origin", 403);
  const context = await getAdminApiContext("settings.write");
  if (!context) return jsonError("Forbidden", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return jsonError("Request too large", 413);
  const parsed = loyaltyConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the points rules. Minimum redemption must be a multiple of its unit");
  if (parsed.data.enabled && context.store.currency !== "AUD") return jsonError("This points programme supports AUD stores only");
  await db.$transaction(async tx => {
    const row = await tx.store.update({ where: { id: context.store.id }, data: { updatedAt: new Date() }, select: { accountConfig: true } });
    const previous = row.accountConfig && typeof row.accountConfig === "object" && !Array.isArray(row.accountConfig) ? row.accountConfig as Record<string, unknown> : {};
    await tx.store.update({ where: { id: context.store.id }, data: { accountConfig: { ...previous, loyalty: parsed.data } } });
    await tx.auditLog.create({ data: { storeId: context.store.id, actorId: context.user.id, action: "LOYALTY_SETTINGS_UPDATED", entityType: "Store", entityId: context.store.id, metadata: parsed.data } });
  });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
const adjustment = z.object({ walletId: z.string().uuid(), points: z.number().int().min(-100000).max(100000).refine(n => n !== 0), reason: z.string().trim().min(10).max(300), key: z.string().uuid() }).strict();
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid origin", 403);
  const context = await getAdminApiContext("settings.write");
  if (!context) return jsonError("Forbidden", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return jsonError("Request too large", 413);
  const parsed = adjustment.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choose a points account, a non-zero adjustment and a reason of at least 10 characters");
  try {
    const result = await adjustLoyalty({ ...parsed.data, storeId: context.store.id, actorId: context.user.id, config: parseLoyaltyConfig(context.store.accountConfig) });
    revalidatePath("/admin/settings/loyalty"); revalidatePath("/dashboard/points");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) { if (error instanceof LoyaltyError) return jsonError(error.message, 409); return jsonError("Points could not be adjusted. Retry the same request", 409); }
}
