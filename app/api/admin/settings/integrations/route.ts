import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminApiContext, hasPermission } from "@/lib/admin";
import { integrationConfigSchema } from "@/lib/integration-config";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid origin", 403);
  const context = await getAdminApiContext();
  if (!context || !hasPermission(context, "settings.write")) return jsonError("Forbidden", 403);
  const parsed = integrationConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the integration IDs and retention period (1–90 days)");
  await db.$transaction(async tx => {
    const store = await tx.store.update({ where: { id: context.store.id }, data: { updatedAt: new Date() }, select: { accountConfig: true } });
    const previous = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
    await tx.store.update({ where: { id: context.store.id }, data: { accountConfig: { ...previous, integrations: parsed.data } } });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "INTEGRATION_SETTINGS_UPDATED", entityType: "Store", entityId: context.store.id } });
  });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
