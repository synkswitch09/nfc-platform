import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { canTransitionJob } from "@/lib/manufacturing";

const schema = z.object({ status: z.enum(["QUEUED", "PRINTING", "POST_PROCESSING", "QA", "ASSEMBLY", "PACKING", "READY", "FAILED", "CANCELLED"]), reason: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid production update", 400);
  const { jobId } = await params;
  const { status, reason } = parsed.data;
  const job = await db.manufacturingJob.findFirst({ where: { id: jobId, storeId: context.store.id }, include: { orderItem: { select: { order: { select: { status: true, storeId: true } } } } } });
  if (!job) return jsonError("Job not found", 404);
  if (job.orderItem.order.storeId !== context.store.id || !["PAID", "PROCESSING"].includes(job.orderItem.order.status)) return jsonError("Order is not available for production", 409);
  if (!canTransitionJob(job.status, status)) return jsonError(`Cannot change ${job.status} to ${status}`, 409);
  if (status === "FAILED" && !reason) return jsonError("Describe the production failure", 400);
  const changed = await db.$transaction(async tx => {
    const open = await tx.orderItem.count({ where: { id: job.orderItemId, order: { storeId: context.store.id, status: { in: ["PAID", "PROCESSING"] } } } });
    if (!open) return false;
    const result = await tx.manufacturingJob.updateMany({ where: { id: jobId, storeId: context.store.id, status: job.status }, data: {
      status, ...(status === "PRINTING" ? { startedAt: new Date() } : {}), ...(status === "READY" ? { completedAt: new Date(), qaPassed: true } : {}), ...(status === "FAILED" ? { failureReason: reason, qaPassed: false } : {}), ...(status === "QUEUED" ? { failureReason: null, qaPassed: null, completedAt: null } : {}),
    } });
    if (!result.count) return false;
    await tx.auditLog.create({ data: { storeId: context.store.id, actorId: context.user.id, action: "MANUFACTURING_JOB_STATUS_CHANGED", entityType: "ManufacturingJob", entityId: jobId, metadata: { from: job.status, to: status, reason: reason ?? null } } });
    return true;
  });
  if (!changed) return jsonError("Job changed; refresh and try again", 409);
  return NextResponse.json({ ok: true });
}
