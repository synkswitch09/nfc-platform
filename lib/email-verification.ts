import { createHmac, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { requiredSecret } from "@/lib/crypto";
import { sendTransactionalEmail } from "@/lib/email";
import { logEvent } from "@/lib/logger";
import type { Storefront } from "@/lib/storefront";

export function createEmailVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function emailVerificationCodeHash(userId: string, storeId: string, code: string) {
  return createHmac("sha256", requiredSecret("SESSION_SECRET"))
    .update(`email-verification:${storeId}:${userId}:${code}`)
    .digest("hex");
}

export async function sendEmailVerificationCode(user: { id: string; email: string }, store: Storefront, orderClaimId?: string | null) {
  const code = createEmailVerificationCode();
  const record = await db.emailVerification.create({
    data: {
      userId: user.id, storeId: store.id, tokenHash: emailVerificationCodeHash(user.id, store.id, code),
      expiresAt: new Date(Date.now() + 10 * 60_000), orderClaimId,
    },
  });
  let sent: boolean;
  try {
    sent = await sendTransactionalEmail({
      to: user.email, subject: `Your ${store.displayName} verification code`,
      text: `Your ${store.displayName} verification code is ${code}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`,
      storeSlug: store.slug,
    });
  } catch {
    await db.emailVerification.delete({ where: { id: record.id } }).catch(() => undefined);
    logEvent("error", "auth.verification_email_failed", { storeId: store.id, userId: user.id });
    return false;
  }
  if (sent) {
    await db.emailVerification.deleteMany({
      where: { userId: user.id, storeId: store.id, usedAt: null, id: { not: record.id } },
    }).catch(() => logEvent("warn", "auth.verification_cleanup_failed", { storeId: store.id, userId: user.id }));
  }
  return sent;
}

export async function completeEmailVerification(record: { id: string; userId: string; storeId: string; orderClaimId: string | null; user: { email: string } }) {
  let claimedOrderId: string | null = null;
  const verified = await db.$transaction(async tx => {
    const consumed = await tx.emailVerification.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    if (record.orderClaimId) {
      const order = await tx.order.findFirst({
        where: { id: record.orderClaimId, storeId: record.storeId, userId: null, claimedAt: null, guestEmail: record.user.email, claimExpiresAt: { gt: new Date() } },
      });
      if (order) {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, userId: null, claimedAt: null },
          data: { userId: record.userId, claimedAt: new Date(), claimTokenHash: null, claimExpiresAt: null },
        });
        if (claimed.count === 1) {
          claimedOrderId = order.id;
          await tx.auditLog.create({ data: { actorId: record.userId, storeId: record.storeId, action: "GUEST_ORDER_CLAIMED", entityType: "Order", entityId: order.id } });
        }
      }
    }
    await tx.emailVerification.deleteMany({ where: { userId: record.userId, storeId: record.storeId, usedAt: null } });
    return true;
  });
  return { verified, destination: claimedOrderId ? `/dashboard/orders/${claimedOrderId}?claimed=true` : "/dashboard?verified=true" };
}
