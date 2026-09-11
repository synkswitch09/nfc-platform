import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ status: z.enum(["ACTIVE", "DISABLED", "LOST", "REPLACED"]), reason: z.string().trim().min(3).max(300) });
const transitions = { MANUFACTURED: ["DISABLED", "REPLACED"], UNCLAIMED: ["DISABLED", "REPLACED"], ACTIVE: ["DISABLED", "LOST", "REPLACED"], DISABLED: ["ACTIVE", "REPLACED"], LOST: ["ACTIVE", "REPLACED"], REPLACED: [] } as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403); const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid tag status");
  const { tagId } = await params;
  const tag = await db.nFCTag.findFirst({ where: { id: tagId, storeId: store.id }, select: { status: true, ownerId: true } });
  if (!tag) return jsonError("Tag not found", 404);
  if (!(transitions[tag.status] as readonly string[]).includes(parsed.data.status)) return jsonError(`Cannot change ${tag.status} to ${parsed.data.status}`, 409);
  if (parsed.data.status === "ACTIVE" && !tag.ownerId) return jsonError("An unowned tag cannot be activated by an administrator", 409);
  const changed = await db.nFCTag.updateMany({ where: { id: tagId, storeId: store.id, status: tag.status }, data: { status: parsed.data.status } });
  if (!changed.count) return jsonError("Tag changed while updating. Refresh and try again.", 409);
  await db.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "TAG_STATUS_CHANGED", entityType: "NFCTag", entityId: tagId, metadata: { from: tag.status, to: parsed.data.status, reason: parsed.data.reason } } });
  return NextResponse.json({ ok: true });
}
