import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyActivationCode, privacyHash } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { activationSchema } from "@/lib/validation";
import { isActivatable } from "@/lib/policies";
import { isManagedProfileType } from "@/lib/product-types";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in before activating a tag", 401);
  const ip = getClientIp(request);
  const [ipLimit, userLimit] = await Promise.all([
    rateLimit("activate-ip", ip, 12, 60 * 60 * 1000),
    rateLimit("activate-user", user.id, 8, 60 * 60 * 1000),
  ]);
  if (!ipLimit.allowed || !userLimit.allowed) return jsonError("Too many activation attempts. Try again later.", 429);

  const parsed = activationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Tag ID or activation code is invalid");
  const tag = await db.nFCTag.findUnique({ where: { publicTagId: parsed.data.publicTagId } });
  const valid = tag
    && isActivatable(tag)
    && await verifyActivationCode(parsed.data.activationCode, tag.activationCodeHash);

  if (!valid || !tag) {
    if (tag) await db.tagActivation.create({ data: { tagId: tag.id, userId: user.id, success: false, ipHash: privacyHash(ip) } });
    return jsonError("Tag ID or activation code is invalid", 400);
  }
  if (!isManagedProfileType(tag.productType)) return jsonError("This product type is not ready for activation", 409);

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.nFCTag.updateMany({
        where: { id: tag.id, ownerId: null, status: "UNCLAIMED" },
        data: { ownerId: user.id, status: "ACTIVE", activatedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("TAG_ALREADY_CLAIMED");
      const profile = await tx.tagProfile.create({ data: { tagId: tag.id, displayName: tag.productType === "PET" ? "My pet" : "My tag" } });
      if (tag.productType === "PET") await tx.petProfile.create({ data: { tagProfileId: profile.id } });
      if (tag.productType === "CHILD") await tx.childProfile.create({ data: { tagProfileId: profile.id } });
      if (tag.productType === "SOCIAL") await tx.socialProfile.create({ data: { tagProfileId: profile.id } });
      if (tag.productType === "BUSINESS") await tx.businessProfile.create({ data: { tagProfileId: profile.id } });
      if (tag.productType === "LUGGAGE") await tx.luggageProfile.create({ data: { tagProfileId: profile.id } });
      await tx.tagActivation.create({ data: { tagId: tag.id, userId: user.id, success: true, ipHash: privacyHash(ip) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "TAG_ACTIVATED", entityType: "NFCTag", entityId: tag.id } });
    });
  } catch {
    return jsonError("This tag can no longer be activated", 409);
  }
  return NextResponse.json({ ok: true, tagId: tag.id });
}
