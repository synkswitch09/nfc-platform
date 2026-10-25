import { jsonValidationError, jsonFieldError } from "@/lib/admin-validation-feedback";
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
  if (!parsed.success) return jsonValidationError(parsed.error);
const c = parsed.data;
  const requiredIds = [
    [c.analyticsEnabled, "ga4MeasurementId", c.ga4MeasurementId, "Google Analytics measurement ID"],
    [c.clarityEnabled, "clarityProjectId", c.clarityProjectId, "Clarity project ID"],
    [c.metaPixelEnabled || c.metaCapiEnabled, "metaPixelId", c.metaPixelId, "Meta pixel ID"],
    [c.metaCatalogEnabled, "metaCatalogId", c.metaCatalogId, "Meta catalog ID"],
  ] as const;
  const missing = requiredIds.filter(([enabled, , id]) => enabled && !id);
  if (missing.length) {
    const issues = missing.map(([, path, , label]) => ({ path, message: `Enter ${label} before enabling this integration, or turn it off.` }));
    return NextResponse.json({ error: issues.map(issue => issue.message).join("\n"), issues }, { status: 400 });
  }
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74892134)`;
    const others = await tx.store.findMany({ where: { id: { not: context.store.id } }, select: { accountConfig: true } });
    for (const other of others) {
      const document = other.accountConfig as Record<string, unknown> | null;
      const integrations = document?.integrations as Record<string, unknown> | undefined;
      for (const key of ["ga4MeasurementId", "clarityProjectId", "metaPixelId", "metaCatalogId"] as const) if (c[key] && integrations?.[key] === c[key]) return key;
    }
    const store = await tx.store.update({ where: { id: context.store.id }, data: { updatedAt: new Date() }, select: { accountConfig: true } });
    const previous = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
    await tx.store.update({ where: { id: context.store.id }, data: { accountConfig: { ...previous, integrations: parsed.data } } });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "INTEGRATION_SETTINGS_UPDATED", entityType: "Store", entityId: context.store.id } });
    return null;
  });
  if (result) return jsonFieldError(result, "This identifier is already used by another store. Enter the identifier for this brand.");
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
