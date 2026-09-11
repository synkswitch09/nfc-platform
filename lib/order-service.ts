import { randomUUID } from "node:crypto";
import { Prisma, StoreCapability, StoreStatus } from "@prisma/client";
import { availableInventory, CatalogValidationError, normalisePersonalisation } from "@/lib/catalog";
import { calculateQuotedOrderTotals } from "@/lib/commerce";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { hasStoreCapability, type Storefront } from "@/lib/storefront";
import { manufacturingRequirements } from "@/lib/manufacturing";
import { shippingCartHash, shippingDestinationHash } from "@/lib/shipping";

export type CheckoutItemInput = { variantId: string; quantity: number; personalisation?: Record<string, string> };
export type CheckoutCustomerInput = {
  userId?: string;
  email: string;
  name: string;
  shipping: { line1: string; line2?: string; suburb: string; state: string; postcode: string; country: "AU" };
};

export class CheckoutError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export async function createPendingOrder(items: CheckoutItemInput[], customer: CheckoutCustomerInput, store: Storefront, shippingQuoteToken: string) {
  if (store.status !== StoreStatus.ACTIVE || !hasStoreCapability(store, StoreCapability.COMMERCE)) throw new CheckoutError("This store is not accepting orders", 409);
  const claimToken = customer.userId ? null : createOpaqueToken();
  return db.$transaction(async tx => {
    const ids = [...new Set(items.map(item => item.variantId))];
    const variants = await tx.productVariant.findMany({
      where: { id: { in: ids }, active: true, product: { storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" } } },
      include: { product: { include: { options: { where: { active: true }, include: { values: true } } } } },
    });
    if (variants.length !== ids.length) throw new CheckoutError("One or more products are unavailable", 409);
    const byId = new Map(variants.map(variant => [variant.id, variant]));

    const lines = items.map(item => {
      const variant = byId.get(item.variantId)!;
      let normalised;
      try { normalised = normalisePersonalisation(variant.product.options, item.personalisation); }
      catch (error) { throw new CheckoutError(error instanceof CatalogValidationError ? error.message : "Invalid personalisation"); }
      const unitPriceCents = variant.priceCents + normalised.priceDeltaCents;
      if (unitPriceCents < 0) throw new CheckoutError("Invalid product price", 409);
      return { item, variant, unitPriceCents, personalisation: normalised.personalisation, selectedOptions: normalised.selectedOptions };
    });

    const requestedByVariant = new Map<string, number>();
    for (const line of lines) requestedByVariant.set(line.variant.id, (requestedByVariant.get(line.variant.id) ?? 0) + line.item.quantity);
    for (const variant of variants) {
      const quantity = requestedByVariant.get(variant.id) ?? 0;
      if (variant.trackInventory && variant.backorderPolicy === "DENY" && availableInventory(variant) < quantity) {
        throw new CheckoutError(`${variant.product.name} does not have enough stock`, 409);
      }
    }

    const quote = await tx.shippingQuote.findFirst({ where: { tokenHash: sha256(shippingQuoteToken), storeId: store.id, status: "ACTIVE", expiresAt: { gt: new Date() } } });
    if (!quote || quote.cartHash !== shippingCartHash(items) || quote.destinationHash !== shippingDestinationHash(customer.shipping)) throw new CheckoutError("Your delivery quote expired or no longer matches this order", 409);
    const consumed = await tx.shippingQuote.updateMany({ where: { id: quote.id, status: "ACTIVE", expiresAt: { gt: new Date() } }, data: { status: "CONSUMED", consumedAt: new Date() } });
    if (consumed.count !== 1) throw new CheckoutError("Your delivery quote has already been used", 409);
    const totals = calculateQuotedOrderTotals(lines.map(line => ({ unitPriceCents: line.unitPriceCents, quantity: line.item.quantity })), quote.amountCents);
    const order = await tx.order.create({
      data: {
        orderNumber: `${store.slug === "tapkin" ? "TK" : store.slug.slice(0, 4).toUpperCase()}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
        userId: customer.userId,
        storeId: store.id,
        sourceDomain: store.hostname,
        checkoutEnvironment: store.environment,
        storeDisplayName: store.displayName,
        guestEmail: customer.userId ? null : customer.email,
        customerName: customer.name,
        claimTokenHash: claimToken ? sha256(claimToken) : null,
        claimExpiresAt: claimToken ? new Date(Date.now() + 30 * 86_400_000) : null,
        shippingName: customer.name,
        shippingLine1: customer.shipping.line1,
        shippingLine2: customer.shipping.line2 || null,
        shippingSuburb: customer.shipping.suburb,
        shippingState: customer.shipping.state,
        shippingPostcode: customer.shipping.postcode,
        shippingCountry: customer.shipping.country,
        shippingProviderKey: quote.providerKey,
        shippingServiceCode: quote.serviceCode,
        shippingServiceName: quote.serviceName,
        shippingQuoteId: quote.id,
        shippingQuoteSnapshot: { amountCents: quote.amountCents, currency: quote.currency, serviceCode: quote.serviceCode, serviceName: quote.serviceName, estimatedDaysMin: quote.estimatedDaysMin, estimatedDaysMax: quote.estimatedDaysMax, createdAt: quote.createdAt.toISOString() },
        packagingSnapshot: quote.packagingSnapshot as Prisma.InputJsonValue,
        shippingOriginSnapshot: quote.originSnapshot as Prisma.InputJsonValue,
        status: "PAYMENT_PENDING",
        currency: store.currency,
        ...totals,
        items: { create: lines.map(({ item, variant, unitPriceCents, personalisation, selectedOptions }) => ({
          variantId: variant.id,
          quantity: item.quantity,
          unitPriceCents,
          productName: variant.product.name,
          variantName: variant.name,
          sku: variant.sku,
          productType: variant.product.type,
          personalisation,
          personalisationMode: variant.product.personalisationMode,
          selectedOptions,
          shippingSnapshot: { weightGrams: variant.weightGrams ?? variant.product.weightGrams, lengthMm: variant.lengthMm ?? variant.product.lengthMm, widthMm: variant.widthMm ?? variant.product.widthMm, heightMm: variant.heightMm ?? variant.product.heightMm, shipsSeparately: variant.product.shipsSeparately, specialHandling: variant.product.specialHandling },
        })) },
        payments: { create: { amountCents: totals.totalCents, currency: store.currency } },
        statusHistory: { create: { toStatus: "PAYMENT_PENDING" } },
      },
      include: { payments: true },
    });

    for (const variant of variants) {
      const quantity = requestedByVariant.get(variant.id) ?? 0;
      if (!variant.trackInventory || variant.backorderPolicy === "ALLOW") continue;
      const reserved = await tx.productVariant.updateMany({
        where: { id: variant.id, reservedInventory: variant.reservedInventory, inventory: { gte: variant.reservedInventory + quantity } },
        data: { reservedInventory: { increment: quantity } },
      });
      if (reserved.count !== 1) throw new CheckoutError("Stock changed while checking out. Please try again.", 409);
      await tx.inventoryMovement.create({ data: { variantId: variant.id, orderId: order.id, type: "RESERVATION", quantity } });
    }

    return { order, lines, claimToken };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function attachCheckoutSession(orderId: string, paymentId: string, providerSessionId: string) {
  await db.payment.updateMany({ where: { id: paymentId, orderId, status: "PENDING" }, data: { providerSessionId } });
}

export async function cancelPendingOrder(orderId: string, reason: string, actorId?: string) {
  await db.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: true } } } });
    if (!order || order.status !== "PAYMENT_PENDING") return;
    const quantities = new Map<string, number>();
    for (const item of order.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    for (const [variantId, quantity] of quantities) {
      const variant = order.items.find(item => item.variantId === variantId)!.variant;
      if (variant.trackInventory && variant.backorderPolicy === "DENY") {
        await tx.productVariant.updateMany({ where: { id: variantId, reservedInventory: { gte: quantity } }, data: { reservedInventory: { decrement: quantity } } });
        await tx.inventoryMovement.create({ data: { variantId, orderId, type: "RELEASE", quantity: -quantity, reason } });
      }
    }
    await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED" } });
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    await tx.orderStatusHistory.create({ data: { orderId, fromStatus: "PAYMENT_PENDING", toStatus: "CANCELLED", actorId, note: reason } });
    if (actorId) await tx.auditLog.create({ data: { actorId, storeId: order.storeId, action: "ORDER_CANCELLED", entityType: "Order", entityId: orderId, metadata: { reason } } });
  });
}

export async function settleCheckoutEvent(input: { eventId: string; eventType: string; providerSessionId: string; orderId: string; storeId: string; amountCents: number; currency: string; paymentIntentId?: string | null }) {
  const result = await db.$transaction(async tx => {
    const seen = await tx.webhookEvent.findUnique({ where: { id: input.eventId } });
    if (seen) return { duplicate: true };
    const payment = await tx.payment.findUnique({ where: { providerSessionId: input.providerSessionId }, include: { order: { include: { store: { select: { capabilities: true } }, items: { include: { variant: true } } } } } });
    if (!payment || payment.orderId !== input.orderId || payment.order.storeId !== input.storeId) throw new CheckoutError("Payment does not match an order", 409);
    if (payment.amountCents !== input.amountCents || payment.currency.toLowerCase() !== input.currency.toLowerCase()) throw new CheckoutError("Payment total does not match the order", 409);
    if (payment.status === "SUCCEEDED") {
      await tx.webhookEvent.create({ data: { id: input.eventId, provider: "stripe", eventType: input.eventType } });
      return { duplicate: true };
    }
    if (payment.order.status !== "PAYMENT_PENDING") throw new CheckoutError("Order is not awaiting payment", 409);

    const quantities = new Map<string, number>();
    for (const item of payment.order.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    for (const [variantId, quantity] of quantities) {
      const variant = payment.order.items.find(item => item.variantId === variantId)!.variant;
      if (!variant.trackInventory) continue;
      if (variant.backorderPolicy === "DENY") {
        const changed = await tx.productVariant.updateMany({ where: { id: variantId, inventory: { gte: quantity }, reservedInventory: { gte: quantity } }, data: { inventory: { decrement: quantity }, reservedInventory: { decrement: quantity } } });
        if (changed.count !== 1) throw new CheckoutError("Reserved stock is no longer available", 409);
      } else if (variant.inventory >= quantity) {
        await tx.productVariant.update({ where: { id: variantId }, data: { inventory: { decrement: quantity } } });
      }
      await tx.inventoryMovement.create({ data: { variantId, orderId: payment.orderId, type: "SALE", quantity: -quantity } });
    }
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", providerPaymentIntentId: input.paymentIntentId ?? null } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: "PAID" } });
    await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, fromStatus: "PAYMENT_PENDING", toStatus: "PAID" } });
    const jobs = payment.order.items.flatMap(item => {
      const requirements = manufacturingRequirements(payment.order.store.capabilities, item.productType);
      return requirements ? [{ storeId: payment.order.storeId, orderItemId: item.id, productVariantId: item.variantId, quantity: item.quantity, material: item.variant.material, colour: item.variant.colour, requiresNfc: requirements.requiresNfc }] : [];
    });
    if (jobs.length) await tx.manufacturingJob.createMany({ data: jobs, skipDuplicates: true });
    await tx.webhookEvent.create({ data: { id: input.eventId, provider: "stripe", eventType: input.eventType } });
    return { duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!result.duplicate) {
    const order = await db.order.findUnique({ where: { id: input.orderId }, select: { orderNumber: true, storeDisplayName: true, guestEmail: true, user: { select: { email: true } } } });
    const email = order?.user?.email ?? order?.guestEmail;
    if (email && order) await sendTransactionalEmail({ to: email, subject: `${order.storeDisplayName} order ${order.orderNumber} confirmed`, text: `Thanks for your ${order.storeDisplayName} order. We have received payment for ${order.orderNumber} and will let you know when production begins.` }).catch(() => undefined);
  }
  return result;
}
