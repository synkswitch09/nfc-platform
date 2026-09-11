import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { canTransitionManufacturing } from "@/lib/manufacturing";

const schema = z.object({ status: z.enum(["GENERATED", "PROGRAMMED", "VERIFIED", "ASSEMBLED", "READY", "ASSIGNED", "SOLD"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403); const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid manufacturing status");
  const { tagId } = await params;
  const tag = await db.nFCTag.findFirst({ where: { id: tagId, storeId: store.id }, select: { manufacturingStatus: true, manufacturingBatchId: true } });
  if (!tag) return jsonError("Tag not found", 404);
  if (!canTransitionManufacturing(tag.manufacturingStatus, parsed.data.status)) return jsonError(`Cannot change ${tag.manufacturingStatus} to ${parsed.data.status}`, 409);
  const now = new Date();
  const timestamp = parsed.data.status === "PROGRAMMED" ? { programmedAt: now } : parsed.data.status === "VERIFIED" ? { verifiedAt: now } : parsed.data.status === "ASSEMBLED" ? { assembledAt: now } : {};
  const changed = await db.$transaction(async tx => {
    const updated = await tx.nFCTag.updateMany({ where: { id: tagId, storeId: store.id, manufacturingStatus: tag.manufacturingStatus }, data: { manufacturingStatus: parsed.data.status, ...(parsed.data.status === "READY" ? { status: "UNCLAIMED" as const } : {}), ...timestamp } });
    if (!updated.count) return false;
    await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "TAG_MANUFACTURING_STATUS_CHANGED", entityType: "NFCTag", entityId: tagId, metadata: { from: tag.manufacturingStatus, to: parsed.data.status } } });
    if (tag.manufacturingBatchId) {
      const pending = await tx.nFCTag.count({ where: { storeId: store.id, manufacturingBatchId: tag.manufacturingBatchId, manufacturingStatus: { not: parsed.data.status } } });
      if (!pending) await tx.manufacturingBatch.updateMany({ where: { id: tag.manufacturingBatchId, storeId: store.id }, data: { status: parsed.data.status } });
    }
    return true;
  });
  if (!changed) return jsonError("Tag changed while updating. Refresh and try again.", 409);
  return NextResponse.json({ ok: true });
}
