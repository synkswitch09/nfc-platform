import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { supportConfigSchema } from "@/lib/support-config";
import { db } from "@/lib/db";
export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext("settings.write");
  if (!context) return jsonError("Forbidden", 403);
  const parsed = supportConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid support settings", 400);
  await db.$transaction(async tx => {
    const store = await tx.store.update({ where: { id: context.store.id }, data: { updatedAt: new Date() }, select: { accountConfig: true } });
    const previous = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
    await tx.store.update({ where: { id: context.store.id }, data: { accountConfig: { ...previous, support: parsed.data } } });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "SUPPORT_SETTINGS_UPDATED", entityType: "Store", entityId: context.store.id } });
  });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
