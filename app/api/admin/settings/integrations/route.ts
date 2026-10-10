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
  const c = parsed.data;
  if ((c.analyticsEnabled && !c.ga4MeasurementId) || (c.clarityEnabled && !c.clarityProjectId) || ((c.metaPixelEnabled || c.metaCapiEnabled) && !c.metaPixelId) || (c.metaCatalogEnabled && !c.metaCatalogId)) return jsonError("Enter a provider ID before enabling that integration");
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74892134)`;
    const others = await tx.store.findMany({ where: { id: { not: context.store.id } }, select: { accountConfig: true } });
    for (const other of others) {
      const document = other.accountConfig as Record<string, unknown> | null;
      const integrations = document?.integrations as Record<string, unknown> | undefined;
      for (const key of ["ga4MeasurementId", "clarityProjectId", "metaPixelId", "metaCatalogId"] as const) if (c[key] && integrations?.[key] === c[key]) return false;
    }
    const store = await tx.store.update({ where: { id: context.store.id }, data: { updatedAt: new Date() }, select: { accountConfig: true } });
    const previous = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
    await tx.store.update({ where: { id: context.store.id }, data: { accountConfig: { ...previous, integrations: parsed.data } } });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "INTEGRATION_SETTINGS_UPDATED", entityType: "Store", entityId: context.store.id } });
    return true;
  });
  if (!result) return jsonError("Each store must use its own analytics stream, Clarity project, Meta dataset and catalog");
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
