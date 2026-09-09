import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activationRegenerationSchema } from "@/lib/admin-validation";
import { createActivationCode, hashActivationCode } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const actor = await getCurrentUser(); if (!actor || actor.role !== "ADMIN") return jsonError("Administrator access required", 403);
  const parsed = activationRegenerationSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid regeneration request");
  const { tagId } = await params; const tag = await db.nFCTag.findUnique({ where: { id: tagId }, select: { status: true, activationCodeVersion: true } });
  if (!tag) return jsonError("Tag not found", 404);
  if (!["MANUFACTURED", "UNCLAIMED"].includes(tag.status)) return jsonError("Activation credentials can be regenerated only before a tag is claimed", 409);
  const activationCode = createActivationCode(); const activationCodeHash = await hashActivationCode(activationCode); const nextVersion = tag.activationCodeVersion + 1;
  await db.$transaction([
    db.nFCTag.update({ where: { id: tagId }, data: { activationCodeHash, activationCodeVersion: nextVersion, activationCodeRegeneratedAt: new Date(), activationLockedUntil: null } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "TAG_ACTIVATION_CREDENTIAL_REGENERATED", entityType: "NFCTag", entityId: tagId, metadata: { reason: parsed.data.reason, note: parsed.data.note, previousVersion: tag.activationCodeVersion, newVersion: nextVersion, oldCredentialInvalidated: true, identityVerified: true } } }),
  ]);
  return NextResponse.json({ activationCode, version: nextVersion });
}
