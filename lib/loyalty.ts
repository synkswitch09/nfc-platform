import { Prisma, type LoyaltyWallet, type Order } from "@prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { loyaltyConfigSchema, loyaltyExpiry, maximumRedeemPoints, proportionalPoints, redemptionCents, type LoyaltyConfig } from "@/lib/loyalty-config";
import { queueOrderNotice } from "@/lib/order-notifications";

type Tx = Prisma.TransactionClient;
const emailKey = (email: string) => sha256(email.trim().toLowerCase());
export class LoyaltyError extends Error {}
async function entry(tx: Tx, walletId: string, eventKey: string, kind: string, points: number, description: string, orderId?: string) {
  await tx.loyaltyEntry.upsert({ where: { walletId_eventKey: { walletId, eventKey } }, create: { walletId, eventKey, kind, points, description, orderId }, update: {} });
}
// Every mutation locks the wallet before inspecting its lots. Serializable callers
// must retry a conflict; a second checkout can never spend the same points.
async function lockWallet(tx: Tx, walletId: string) {
  return tx.loyaltyWallet.update({ where: { id: walletId }, data: { updatedAt: new Date() } });
}
async function walletForEmail(tx: Tx, storeId: string, email: string) {
  const wallet = await tx.loyaltyWallet.upsert({ where: { storeId_emailHash: { storeId, emailHash: emailKey(email) } }, create: { storeId, emailHash: emailKey(email) }, update: {} });
  return lockWallet(tx, wallet.id);
}
async function expireWallet(tx: Tx, walletId: string, now: Date) {
  const lots = await tx.loyaltyLot.findMany({ where: { walletId, expiresAt: { lte: now }, remainingPoints: { gt: 0 } }, orderBy: { id: "asc" } });
  for (const lot of lots) {
    await tx.loyaltyLot.update({ where: { id: lot.id }, data: { remainingPoints: 0, expiredPoints: { increment: lot.remainingPoints } } });
    await entry(tx, walletId, `expiry:${lot.id}`, "EXPIRED", -lot.remainingPoints, "Unused points reached their original expiry date", lot.orderId ?? undefined);
  }
}
async function available(tx: Tx, wallet: LoyaltyWallet, now: Date) {
  const lots = await tx.loyaltyLot.findMany({ where: { walletId: wallet.id, remainingPoints: { gt: 0 }, expiresAt: { gt: now } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }] });
  return { lots, balance: Math.max(0, lots.reduce((n, l) => n + l.remainingPoints, 0) - wallet.debtPoints) };
}
async function credit(tx: Tx, walletId: string, lotId: string, points: number) {
  const wallet = await tx.loyaltyWallet.findUniqueOrThrow({ where: { id: walletId } });
  const debtPaid = Math.min(points, wallet.debtPoints);
  if (debtPaid) await tx.loyaltyWallet.update({ where: { id: walletId }, data: { debtPoints: { decrement: debtPaid } } });
  if (points > debtPaid) {
    const lot = await tx.loyaltyLot.findUniqueOrThrow({ where: { id: lotId } });
    const returning = points - debtPaid;
    const capacity = Math.max(0, lot.originalPoints - lot.revokedPoints - lot.expiredPoints - lot.remainingPoints);
    const intoOriginal = Math.min(returning, capacity);
    if (intoOriginal) await tx.loyaltyLot.update({ where: { id: lotId }, data: { remainingPoints: { increment: intoOriginal } } });
    // A reserved award may have been refunded while its points were held. If
    // other credits already paid that adjustment, return a compensating lot
    // with the original expiry instead of resurrecting the revoked award.
    if (returning > intoOriginal) await tx.loyaltyLot.create({ data: { walletId, originalPoints: returning - intoOriginal, remainingPoints: returning - intoOriginal, expiresAt: lot.expiresAt } });
  }
  return points - debtPaid;
}
export async function reserveLoyalty(tx: Tx, order: Order, userId: string, config: LoyaltyConfig) {
  if (!order.loyaltyPointsUsed) return;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, emailVerifiedAt: true, status: true } });
  if (!user?.emailVerifiedAt || user.status !== "ACTIVE") throw new LoyaltyError("Sign in with a verified account to use points");
  const wallet = await walletForEmail(tx, order.storeId, user.email);
  if (wallet.userId && wallet.userId !== user.id) throw new LoyaltyError("Points ownership requires review");
  await tx.loyaltyWallet.update({ where: { id: wallet.id }, data: { userId: user.id } });
  const now = new Date(); await expireWallet(tx, wallet.id, now);
  const { lots, balance } = await available(tx, wallet, now);
  if (wallet.debtPoints || order.loyaltyPointsUsed > maximumRedeemPoints(config, balance, order.loyaltyEligibleCents + order.loyaltyDiscountCents)) throw new LoyaltyError("Your available points or redemption limit changed. Refresh checkout");
  if (redemptionCents(config, order.loyaltyPointsUsed) !== order.loyaltyDiscountCents) throw new LoyaltyError("Points discount does not match this order");
  const reservation = await tx.loyaltyReservation.create({ data: { walletId: wallet.id, orderId: order.id, points: order.loyaltyPointsUsed, discountCents: order.loyaltyDiscountCents } });
  let needed = order.loyaltyPointsUsed;
  for (const lot of lots) {
    const take = Math.min(needed, lot.remainingPoints); if (!take) continue;
    const changed = await tx.loyaltyLot.updateMany({ where: { id: lot.id, remainingPoints: { gte: take } }, data: { remainingPoints: { decrement: take } } });
    if (changed.count !== 1) throw new LoyaltyError("Points changed while checking out. Try again");
    await tx.loyaltyAllocation.create({ data: { reservationId: reservation.id, lotId: lot.id, points: take } });
    needed -= take; if (!needed) break;
  }
  if (needed) throw new LoyaltyError("Insufficient points");
  await entry(tx, wallet.id, `reserve:${order.id}`, "RESERVED", -order.loyaltyPointsUsed, "Reserved for secure checkout; released only after confirmed cancellation", order.id);
}
async function restoreReservation(tx: Tx, reservationId: string, target: number, key: string, cancel: boolean) {
  const reservation = await tx.loyaltyReservation.findUniqueOrThrow({ where: { id: reservationId }, include: { allocations: { include: { lot: true }, orderBy: { id: "asc" } } } });
  await lockWallet(tx, reservation.walletId);
  if (cancel && reservation.status !== "HELD") return;
  if (!cancel && reservation.status !== "SPENT") return;
  let needed = Math.max(0, Math.min(target, reservation.points) - reservation.restoredPoints);
  const restored = needed; let spendable = 0; const now = new Date();
  for (const allocation of reservation.allocations) {
    const amount = Math.min(needed, allocation.points - allocation.restoredPoints); if (!amount) continue;
    await tx.loyaltyAllocation.update({ where: { id: allocation.id }, data: { restoredPoints: { increment: amount } } });
    if (allocation.lot.expiresAt > now) spendable += await credit(tx, reservation.walletId, allocation.lotId, amount);
    else {
      // An expired reservation return can still settle debt from a revoked award,
      // but never revives an expired balance.
      const wallet = await tx.loyaltyWallet.findUniqueOrThrow({ where: { id: reservation.walletId } });
      const debtPaid = Math.min(amount, wallet.debtPoints);
      if (debtPaid) await tx.loyaltyWallet.update({ where: { id: wallet.id }, data: { debtPoints: { decrement: debtPaid } } });
      const current = await tx.loyaltyLot.findUniqueOrThrow({ where: { id: allocation.lotId } });
      const capacity = Math.max(0, current.originalPoints - current.revokedPoints - current.expiredPoints - current.remainingPoints);
      const expired = Math.min(amount - debtPaid, capacity);
      if (expired) await tx.loyaltyLot.update({ where: { id: allocation.lotId }, data: { expiredPoints: { increment: expired } } });
    }
    needed -= amount; if (!needed) break;
  }
  if (needed) throw new LoyaltyError("Points allocation requires review");
  await tx.loyaltyReservation.update({ where: { id: reservation.id }, data: { restoredPoints: { increment: restored }, ...(cancel ? { status: "RELEASED" } : {}) } });
  if (restored) await entry(tx, reservation.walletId, key, cancel ? "RELEASED" : "REFUND_RETURN", spendable, `${restored} points returned subject to original expiry and any refund adjustment`, reservation.orderId);
}
export async function releaseLoyalty(tx: Tx, order: Pick<Order, "id" | "loyaltyPointsUsed">) {
  if (!order.loyaltyPointsUsed) return;
  const reservation = await tx.loyaltyReservation.findUnique({ where: { orderId: order.id } });
  if (reservation) await restoreReservation(tx, reservation.id, reservation.points, `release:${order.id}`, true);
}
export async function settleLoyalty(tx: Tx, order: Order) {
  if (!order.loyaltySnapshot) return; // No retrospective credits for legacy orders.
  const parsed = loyaltyConfigSchema.safeParse(order.loyaltySnapshot);
  if (!parsed.success || order.currency !== "AUD") throw new LoyaltyError("Order points snapshot requires review");
  const config = parsed.data; const now = new Date();
  const email = order.userId ? (await tx.user.findUnique({ where: { id: order.userId }, select: { email: true } }))?.email : order.guestEmail;
  if (!email) throw new LoyaltyError("Order points owner is missing");
  const wallet = await walletForEmail(tx, order.storeId, email);
  if (order.loyaltyPointsUsed) {
    const reservation = await tx.loyaltyReservation.findUniqueOrThrow({ where: { orderId: order.id } });
    if (reservation.walletId !== wallet.id || reservation.points !== order.loyaltyPointsUsed || reservation.status === "RELEASED") throw new LoyaltyError("Order points reservation does not match");
    await tx.loyaltyReservation.update({ where: { id: reservation.id }, data: { status: "SPENT" } });
    await entry(tx, wallet.id, `spent:${order.id}`, "REDEEMED", 0, `${reservation.points} reserved points used for an A$${(reservation.discountCents / 100).toFixed(2)} discount`, order.id);
  }
  if (await tx.loyaltyLot.findUnique({ where: { orderId: order.id } })) return;
  const points = Math.floor(order.loyaltyEligibleCents * config.pointsPerDollar / 100);
  if (!points) return;
  const lot = await tx.loyaltyLot.create({ data: { walletId: wallet.id, orderId: order.id, originalPoints: points, remainingPoints: 0, expiresAt: loyaltyExpiry(now, config.expiryMonths) } });
  const spendable = await credit(tx, wallet.id, lot.id, points);
  await entry(tx, wallet.id, `earned:${order.id}`, "EARNED", spendable, `${points} points earned after confirmed payment${spendable < points ? "; previous refund adjustment offset" : ""}`, order.id);
  await queueOrderNotice(tx, order.id, `loyalty:${order.id}`, "Points earned", `This purchase earned ${points} ${order.storeDisplayName} points. ${spendable} points were added to the available balance${spendable < points ? " after offsetting a previous refund adjustment" : ""}. These points expire on ${lot.expiresAt.toISOString().slice(0, 10)}. Sign in or create an account and verify this purchase email to see your balance. Points are separate for each store and can be managed under Account → Points.`);
}
export async function refundLoyalty(tx: Tx, order: Order, totalRefundedCents: number, refundId: string) {
  if (!order.loyaltySnapshot) return;
  const lot = await tx.loyaltyLot.findUnique({ where: { orderId: order.id } });
  if (lot) {
    await lockWallet(tx, lot.walletId); await expireWallet(tx, lot.walletId, new Date());
    const current = await tx.loyaltyLot.findUniqueOrThrow({ where: { id: lot.id } });
    const target = proportionalPoints(current.originalPoints, totalRefundedCents, order.totalCents);
    const revoke = Math.max(0, target - current.revokedPoints);
    if (revoke) {
      const fromRemaining = Math.min(revoke, current.remainingPoints);
      const fromExpired = Math.min(revoke - fromRemaining, current.expiredPoints);
      const debt = revoke - fromRemaining - fromExpired;
      await tx.loyaltyLot.update({ where: { id: lot.id }, data: { remainingPoints: { decrement: fromRemaining }, expiredPoints: { decrement: fromExpired }, revokedPoints: { increment: revoke } } });
      let offset = 0;
      if (debt) {
        await tx.loyaltyWallet.update({ where: { id: lot.walletId }, data: { debtPoints: { increment: debt } } });
        // Existing credits offset the adjustment first, so a positive balance is
        // never presented alongside a debt that would prevent redemption.
        const otherLots = await tx.loyaltyLot.findMany({ where: { walletId: lot.walletId, remainingPoints: { gt: 0 }, expiresAt: { gt: new Date() } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }] });
        let outstanding = debt;
        for (const other of otherLots) {
          const take = Math.min(outstanding, other.remainingPoints); if (!take) continue;
          await tx.loyaltyLot.update({ where: { id: other.id }, data: { remainingPoints: { decrement: take } } });
          offset += take; outstanding -= take; if (!outstanding) break;
        }
        if (offset) await tx.loyaltyWallet.update({ where: { id: lot.walletId }, data: { debtPoints: { decrement: offset } } });
      }
      await entry(tx, lot.walletId, `refund-earned:${refundId}`, "REFUND_ADJUSTMENT", -fromRemaining - offset, `${revoke} earned points reversed proportionally to the confirmed cash refund${debt ? `; already used points offset other or future credits` : ""}`, order.id);
    }
  }
  if (order.loyaltyPointsUsed) {
    const reservation = await tx.loyaltyReservation.findUnique({ where: { orderId: order.id } });
    if (reservation) await restoreReservation(tx, reservation.id, proportionalPoints(reservation.points, totalRefundedCents, order.totalCents), `refund-redeemed:${refundId}`, false);
  }
}
async function serial<T>(callback: (tx: Tx) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") || attempt >= 2) throw e; }
  }
}
export async function loyaltyAccount(user: { id: string; email: string; emailVerifiedAt: Date | null }, storeId: string) {
  if (!user.emailVerifiedAt) throw new LoyaltyError("Verify your email to access points");
  return serial(async tx => {
    const wallet = await walletForEmail(tx, storeId, user.email);
    if (wallet.userId && wallet.userId !== user.id) throw new LoyaltyError("Points ownership requires review");
    await tx.loyaltyWallet.update({ where: { id: wallet.id }, data: { userId: user.id } });
    const now = new Date(); await expireWallet(tx, wallet.id, now);
    const { lots, balance } = await available(tx, wallet, now);
    const [held, history] = await Promise.all([
      tx.loyaltyReservation.aggregate({ where: { walletId: wallet.id, status: "HELD" }, _sum: { points: true } }),
      tx.loyaltyEntry.findMany({ where: { walletId: wallet.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, kind: true, points: true, description: true, createdAt: true, order: { select: { orderNumber: true } } } }),
    ]);
    return { balance, debtPoints: wallet.debtPoints, reservedPoints: held._sum.points ?? 0, expiring: lots.slice(0, 10).map(l => ({ points: l.remainingPoints, expiresAt: l.expiresAt })), history };
  });
}
export async function adjustLoyalty(input: { storeId: string; walletId: string; points: number; reason: string; key: string; actorId: string; config: LoyaltyConfig }) {
  return serial(async tx => {
    const found = await tx.loyaltyWallet.findFirst({ where: { id: input.walletId, storeId: input.storeId } });
    if (!found) throw new LoyaltyError("Points account not found in this store");
    const wallet = await lockWallet(tx, found.id); const key = `manual:${input.key}`;
    if (await tx.loyaltyEntry.findUnique({ where: { walletId_eventKey: { walletId: wallet.id, eventKey: key } } })) return { duplicate: true };
    const now = new Date(); await expireWallet(tx, wallet.id, now);
    let delta = input.points;
    if (delta > 0) {
      const lot = await tx.loyaltyLot.create({ data: { walletId: wallet.id, originalPoints: delta, remainingPoints: 0, expiresAt: loyaltyExpiry(now, input.config.expiryMonths) } });
      delta = await credit(tx, wallet.id, lot.id, delta);
    } else {
      const { lots, balance } = await available(tx, wallet, now);
      if (-delta > balance) throw new LoyaltyError("Adjustment exceeds available points; reserved points cannot be removed");
      let needed = -delta;
      for (const lot of lots) {
        const take = Math.min(needed, lot.remainingPoints); if (!take) continue;
        await tx.loyaltyLot.update({ where: { id: lot.id }, data: { remainingPoints: { decrement: take }, revokedPoints: { increment: take } } });
        needed -= take; if (!needed) break;
      }
    }
    await entry(tx, wallet.id, key, "MANUAL_ADJUSTMENT", delta, input.reason);
    await tx.auditLog.create({ data: { storeId: input.storeId, actorId: input.actorId, action: "LOYALTY_ADJUSTED", entityType: "LoyaltyWallet", entityId: wallet.id, metadata: { points: input.points, reason: input.reason, requestKey: input.key } } });
    return { duplicate: false };
  });
}
export async function processLoyaltyExpiry() {
  const due = await db.loyaltyLot.findMany({ where: { expiresAt: { lte: new Date() }, remainingPoints: { gt: 0 } }, distinct: ["walletId"], take: 50, select: { walletId: true } });
  for (const row of due) await serial(async tx => { await lockWallet(tx, row.walletId); await expireWallet(tx, row.walletId, new Date()); });
  return { checked: due.length };
}
