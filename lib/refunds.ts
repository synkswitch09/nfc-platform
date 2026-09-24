import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { queueOrderNotice } from "@/lib/order-notifications";
import { queueEtsyInventorySync } from "@/lib/etsy";

const providerOptions = { timeout: 10_000, maxNetworkRetries: 0 };

export class RefundError extends Error {}

export async function requestFullRefund(input: { orderId: string; storeId: string; actorId: string; orderNumber: string; amountCents: number; reason: string }) {
  if (!getStripe()) throw new RefundError("Stripe is not configured");
  return db.$transaction(async tx => {
    const order = await tx.order.findFirst({ where: { id: input.orderId, storeId: input.storeId }, include: { payments: true } });
    if (!order || order.orderNumber !== input.orderNumber || order.totalCents !== input.amountCents) throw new RefundError("Order or confirmed amount does not match");
    const payments = order.payments.filter(p => ["SUCCEEDED", "REFUNDED"].includes(p.status));
    if (payments.length !== 1) throw new RefundError("This payment requires manual review");
    const payment = payments[0];
    if (payment.provider !== "stripe" || !payment.providerPaymentIntentId || payment.amountCents !== input.amountCents || input.amountCents <= 0) throw new RefundError("Only a single captured Stripe payment can be fully refunded here");
    const requestKey = `full:${payment.id}`;
    const existing = await tx.paymentRefund.findUnique({ where: { requestKey } });
    if (existing) return existing;
    if (payment.refundedAmountCents || await tx.paymentRefund.count({ where: { paymentId: payment.id } })) throw new RefundError("A refund already exists. Review it before requesting another");
    const refund = await tx.paymentRefund.create({ data: { paymentId: payment.id, requestKey, amountCents: payment.amountCents, currency: payment.currency, reason: input.reason } });
    await tx.auditLog.create({ data: { storeId: input.storeId, actorId: input.actorId, action: "REFUND_REQUESTED", entityType: "PaymentRefund", entityId: refund.id, metadata: { orderId: order.id, amountCents: refund.amountCents, reason: input.reason } } });
    return refund;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function applyStripeRefund(remote: Stripe.Refund) {
  const intentId = typeof remote.payment_intent === "string" ? remote.payment_intent : remote.payment_intent?.id;
  if (!intentId) throw new RefundError("Refund has no payment intent; manual review required");
  return db.$transaction(async tx => {
    const payment = await tx.payment.findUnique({ where: { providerPaymentIntentId: intentId }, include: { order: true } });
    // Other applications may share a Stripe account; ignore refunds not belonging to this app.
    if (!payment || payment.provider !== "stripe") return { ignored: true };
    if (remote.currency.toLowerCase() !== payment.currency.toLowerCase() || remote.amount <= 0 || remote.amount > payment.amountCents) throw new RefundError("Refund amount/currency mismatch");
    const localId = remote.metadata?.localRefundId;
    const existing = await tx.paymentRefund.findFirst({ where: { OR: [{ providerRefundId: remote.id }, ...(localId ? [{ id: localId }] : [])] } });
    if (existing && (existing.paymentId !== payment.id || (existing.providerRefundId && existing.providerRefundId !== remote.id) || existing.amountCents !== remote.amount)) throw new RefundError("Refund ownership mismatch");
    const status = remote.status === "succeeded" ? "SUCCEEDED" : remote.status === "failed" || remote.status === "canceled" ? "FAILED" : remote.status === "requires_action" ? "REVIEW_REQUIRED" : "PENDING";
    // Never regress confirmed success because a concurrent handler fetched an older state.
    if (existing?.status === "SUCCEEDED" && status !== "SUCCEEDED") return { ignored: true };
    const data = { providerRefundId: remote.id, status, lastError: status === "FAILED" ? remote.failure_reason ?? "Provider rejected/cancelled refund" : status === "REVIEW_REQUIRED" ? "Stripe requires action; review in Stripe" : null, leaseUntil: null, nextAttemptAt: new Date(Date.now() + 300_000) };
    const refund = existing
      ? await tx.paymentRefund.update({ where: { id: existing.id }, data })
      : await tx.paymentRefund.create({ data: { ...data, paymentId: payment.id, requestKey: `external:${remote.id}`, amountCents: remote.amount, currency: remote.currency, reason: "Refund recorded from Stripe" } });
    const total = await tx.paymentRefund.aggregate({ where: { paymentId: payment.id, status: "SUCCEEDED" }, _sum: { amountCents: true } });
    const amount = total._sum.amountCents ?? 0;
    if (amount > payment.amountCents) throw new RefundError("Refund total exceeds payment; review required");
    await tx.payment.update({ where: { id: payment.id }, data: { refundedAmountCents: amount, ...(amount === payment.amountCents ? { status: "REFUNDED" } : {}) } });
    if (!existing || existing.status !== status) {
      await tx.auditLog.create({ data: { storeId: payment.order.storeId, action: "REFUND_STATUS_CHANGED", entityType: "PaymentRefund", entityId: refund.id, metadata: { orderId: payment.orderId, status, amountCents: remote.amount, partial: amount > 0 && amount < payment.amountCents } } });
      if (status === "SUCCEEDED") await queueOrderNotice(tx, payment.orderId, `refund:${refund.id}`, "Refund confirmed", `A refund of ${(remote.amount / 100).toFixed(2)} ${payment.currency} has been confirmed by the payment provider. Your bank determines when it appears in your account.`);
    }
    return { refundId: refund.id, status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function processRefund(id: string) {
  const stripe = getStripe();
  if (!stripe) return;
  const claimed = await db.paymentRefund.updateMany({ where: { id, status: { in: ["REQUESTED", "PENDING", "REVIEW_REQUIRED"] }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 300_000) } });
  if (!claimed.count) return;
  const row = await db.paymentRefund.findUniqueOrThrow({ where: { id }, include: { payment: true } });
  try {
    if (row.providerRefundId) { await applyStripeRefund(await stripe.refunds.retrieve(row.providerRefundId, {}, providerOptions)); return; }
    const intent = row.payment.providerPaymentIntentId;
    if (!intent) throw new RefundError("Missing payment intent");
    // Inspect the provider first, including refunds made directly in its dashboard.
    const refunds = await stripe.refunds.list({ payment_intent: intent, limit: 100 }, providerOptions);
    const matched = refunds.data.find(refund => refund.metadata?.localRefundId === row.id);
    if (matched) { await applyStripeRefund(await stripe.refunds.retrieve(matched.id, {}, providerOptions)); return; }
    if (refunds.data.length || refunds.has_more || Date.now() - row.createdAt.getTime() >= 20 * 3600_000) {
      for (const refund of refunds.data) await applyStripeRefund(refund);
      await db.paymentRefund.updateMany({ where: { id, providerRefundId: null }, data: { status: "REVIEW_REQUIRED", lastError: "Existing provider refund or expired safe retry window. Review in Stripe; no new refund sent.", leaseUntil: null, nextAttemptAt: new Date(Date.now() + 3600_000) } });
      return;
    }
    const remote = await stripe.refunds.create({ payment_intent: intent, amount: row.amountCents, reason: "requested_by_customer", metadata: { localRefundId: row.id } }, { ...providerOptions, idempotencyKey: row.id });
    await applyStripeRefund(remote);
  } catch {
    // Keep the same request/key. A network error does not prove that no refund happened.
    await db.paymentRefund.updateMany({ where: { id, status: { in: ["REQUESTED", "PENDING", "REVIEW_REQUIRED"] } }, data: { lastError: "Provider outcome uncertain or reconciliation failed; retry/review required", leaseUntil: null, nextAttemptAt: new Date(Date.now() + 300_000) } });
  }
}

export async function processPendingRefunds() {
  const refunds = await db.paymentRefund.findMany({ where: { status: { in: ["REQUESTED", "PENDING", "REVIEW_REQUIRED"] }, nextAttemptAt: { lte: new Date() }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, orderBy: { nextAttemptAt: "asc" }, take: 3 });
  for (const refund of refunds) await processRefund(refund.id);
  return { checked: refunds.length };
}

export async function restockRefundedOrder(orderId: string, storeId: string, actorId: string, reason: string) {
  return db.$transaction(async tx => {
    const payment = await tx.payment.findFirst({ where: { orderId, status: "REFUNDED", order: { storeId } } });
    if (!payment || payment.refundedAmountCents !== payment.amountCents) throw new RefundError("No confirmed full refund for this order");
    const claimed = await tx.payment.updateMany({ where: { id: payment.id, refundRestockedAt: null }, data: { refundRestockedAt: new Date() } });
    if (!claimed.count) return { duplicate: true };
    const sales = await tx.inventoryMovement.groupBy({ by: ["variantId"], where: { orderId, type: { in: ["SALE", "RETURN"] } }, _sum: { quantity: true } });
    for (const sale of sales) {
      const quantity = Math.max(0, -(sale._sum.quantity ?? 0));
      if (!quantity) continue;
      const variant = await tx.productVariant.update({ where: { id: sale.variantId }, data: { inventory: { increment: quantity } } });
      await tx.inventoryMovement.create({ data: { variantId: variant.id, orderId, actorId, type: "RETURN", quantity, reason } });
      await queueEtsyInventorySync(tx, storeId, variant.productId);
    }
    await tx.auditLog.create({ data: { storeId, actorId, action: "REFUND_STOCK_RETURNED", entityType: "Order", entityId: orderId, metadata: { reason } } });
    return { duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
