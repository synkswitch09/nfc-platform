import type { Prisma } from "@prisma/client";
import { availableInventory, CatalogValidationError, normalisePersonalisation } from "@/lib/catalog";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { packPhysicalLines, shippingCartHash, shippingDestinationHash, type ShippingCartInput, type ShippingDestination, zoneMatches } from "@/lib/shipping";
import { shippingProviderAdapter, type ConfiguredRate, type ProviderRate } from "@/lib/shipping-providers";
import type { Storefront } from "@/lib/storefront";

const QUOTE_TTL_MS = 15 * 60 * 1000;

export class ShippingError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export async function createShippingQuotes(items: ShippingCartInput[], destination: ShippingDestination, store: Storefront) {
  const ids = [...new Set(items.map(item => item.variantId))];
  const [variants, origins, packaging, zones] = await Promise.all([
    db.productVariant.findMany({
      where: { id: { in: ids }, active: true, product: { storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" } } },
      include: {
        defaultPackaging: true,
        product: { include: { defaultPackaging: true, options: { where: { active: true }, include: { values: true } } } },
      },
    }),
    db.shippingOrigin.findMany({ where: { storeId: store.id, active: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    db.packaging.findMany({ where: { storeId: store.id, active: true }, orderBy: { createdAt: "asc" } }),
    db.shippingZone.findMany({ where: { storeId: store.id, active: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] }),
  ]);
  if (variants.length !== ids.length) throw new ShippingError("One or more products are unavailable", 409);
  const byId = new Map(variants.map(variant => [variant.id, variant]));

  let subtotalCents = 0;
  const physicalLines = items.map(item => {
    const variant = byId.get(item.variantId)!;
    let normalised;
    try { normalised = normalisePersonalisation(variant.product.options, item.personalisation); }
    catch (error) { throw new ShippingError(error instanceof CatalogValidationError ? error.message : "Invalid personalisation"); }
    if (variant.trackInventory && variant.backorderPolicy === "DENY" && availableInventory(variant) < item.quantity) throw new ShippingError(`${variant.product.name} does not have enough stock`, 409);
    subtotalCents += (variant.priceCents + normalised.priceDeltaCents) * item.quantity;
    return {
      quantity: item.quantity,
      weightGrams: variant.weightGrams ?? variant.product.weightGrams ?? 100,
      lengthMm: variant.lengthMm ?? variant.product.lengthMm ?? 100,
      widthMm: variant.widthMm ?? variant.product.widthMm ?? 100,
      heightMm: variant.heightMm ?? variant.product.heightMm ?? 30,
      shipsSeparately: variant.product.shipsSeparately,
      package: variant.defaultPackaging ?? variant.product.defaultPackaging,
    };
  });

  const selectedPackaging = physicalLines.find(line => line.package)?.package ?? packaging[0];
  const origin = origins[0];
  if (!selectedPackaging || !origin) throw new ShippingError("Shipping is not configured for this store", 503);
  const zone = zones.find(candidate => zoneMatches(destination, candidate));
  if (!zone) throw new ShippingError("We do not currently ship to this address", 409);
  const parcels = packPhysicalLines(physicalLines, selectedPackaging);
  const rates = await db.shippingRate.findMany({
    where: { storeId: store.id, zoneId: zone.id, active: true },
    include: { provider: true },
    orderBy: [{ priority: "desc" }, { amountCents: "asc" }],
  });
  const groups = new Map<string, typeof rates>();
  for (const rate of rates) {
    const key = rate.provider?.key ?? "manual";
    groups.set(key, [...(groups.get(key) ?? []), rate]);
  }

  const offered: ProviderRate[] = [];
  for (const [providerKey, configured] of groups) {
    const provider = configured[0]?.provider;
    const kind = provider?.kind ?? "MANUAL";
    try {
      const adapter = shippingProviderAdapter(kind);
      const mapped: ConfiguredRate[] = configured.map(rate => ({
        providerKey,
        serviceCode: rate.serviceCode,
        serviceName: rate.serviceName,
        amountCents: rate.amountCents,
        freeOverCents: rate.freeOverCents,
        minWeightGrams: rate.minWeightGrams,
        maxWeightGrams: rate.maxWeightGrams,
        estimatedDaysMin: rate.estimatedDaysMin,
        estimatedDaysMax: rate.estimatedDaysMax,
      }));
      offered.push(...await adapter.quote({ destination, parcels, subtotalCents, currency: store.currency }, mapped));
    } catch {
      // A provider failure never authorises an unconfigured price. Other configured providers may still respond.
    }
  }
  if (!offered.length) throw new ShippingError("No delivery service is available for this order", 503);

  const cartHash = shippingCartHash(items);
  const destinationHash = shippingDestinationHash(destination);
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
  const originSnapshot = originSnapshotOf(origin);
  const packagingSnapshot = { id: selectedPackaging.id, code: selectedPackaging.code, name: selectedPackaging.name, lengthMm: selectedPackaging.lengthMm, widthMm: selectedPackaging.widthMm, heightMm: selectedPackaging.heightMm, emptyWeightGrams: selectedPackaging.emptyWeightGrams, parcels };

  return Promise.all(offered.map(async rate => {
    const token = createOpaqueToken();
    await db.shippingQuote.create({ data: {
      storeId: store.id,
      tokenHash: sha256(token),
      cartHash,
      destinationHash,
      providerKey: rate.providerKey,
      serviceCode: rate.serviceCode,
      serviceName: rate.serviceName,
      amountCents: rate.amountCents,
      currency: store.currency,
      estimatedDaysMin: rate.estimatedDaysMin,
      estimatedDaysMax: rate.estimatedDaysMax,
      originSnapshot: originSnapshot as Prisma.InputJsonValue,
      packagingSnapshot: packagingSnapshot as Prisma.InputJsonValue,
      expiresAt,
    } });
    return { token, ...rate, currency: store.currency, expiresAt: expiresAt.toISOString() };
  }));
}

export function originSnapshotOf(origin: { id: string; name: string; senderName: string; company: string | null; line1: string; line2: string | null; suburb: string; state: string; postcode: string; country: string; phone: string | null; email: string | null }) {
  return { id: origin.id, name: origin.name, senderName: origin.senderName, company: origin.company, line1: origin.line1, line2: origin.line2, suburb: origin.suburb, state: origin.state, postcode: origin.postcode, country: origin.country, phone: origin.phone, email: origin.email };
}
