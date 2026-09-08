import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ status: z.enum(["ACTIVE", "DISABLED", "LOST"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorised", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid status");
  const { tagId } = await params;
  const updated = await db.nFCTag.updateMany({
    where: { id: tagId, ownerId: user.id, status: { in: ["ACTIVE", "DISABLED", "LOST"] } },
    data: { status: parsed.data.status },
  });
  if (updated.count !== 1) return jsonError("Tag not found", 404);
  await db.auditLog.create({ data: { actorId: user.id, action: `TAG_${parsed.data.status}`, entityType: "NFCTag", entityId: tagId } });
  return NextResponse.json({ ok: true });
}
