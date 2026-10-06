import type { Prisma } from "@prisma/client";
import { assertVariantSelection, availableInventory, normalisePersonalisation } from "@/lib/catalog";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { packCheckoutParcels, shippingCartHash, shippingDestinationHash, type ShippingCartInput, type ShippingDestination, zoneMatches } from "@/lib/shipping";
import { shippingProviderAdapter, type ConfiguredRate, type ProviderRate } from "@/lib/shipping-providers";
import type { Storefront } from "@/lib/storefront";
import { isKeychainProduct, keychainPaletteFromOptions, validateKeychainOptions } from "@/lib/keychain-order";
import { currentAppEnvironment } from "@/lib/config";
import { quoteShippitParcels } from "@/lib/shippit-quotes";

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
    try {
      normalised = normalisePersonalisation(variant.product.options, item.personalisation, variant.product.personalisationMode, item.personalisationChoice, variant.optionSelection as Record<string, string>);
      assertVariantSelection(variant.optionSelection, normalised.selectedOptions);
      if (isKeychainProduct(store.slug, variant.product.slug)) validateKeychainOptions(normalised.personalisation, normalised.selectedOptions, keychainPaletteFromOptions(variant.product.options));
    }
    catch (error) { throw new ShippingError(error instanceof Error ? error.message : "Invalid personalisation"); }
    if (variant.trackInventory && variant.backorderPolicy === "DENY" && availableInventory(variant) < item.quantity) throw new ShippingError(`${variant.product.name} does not have enough stock`, 409);
    subtotalCents += (variant.priceCents + normalised.priceDeltaCents) * item.quantity;
    return {
      quantity: item.quantity,
      weightGrams: variant.product.weightGrams,
      lengthMm: variant.product.lengthMm,
      widthMm: variant.product.widthMm,
      heightMm: variant.product.heightMm,
      shipsSeparately: variant.product.shipsSeparately,
      packageType: variant.product.shippingPackageType,
      package: variant.product.defaultPackaging,
    };
  });

  const origin = origins[0];
  const storeDefaultPackaging = packaging[0];
  if (!storeDefaultPackaging || !origin) throw new ShippingError("Shipping is not configured for this store", 503);
  const zone = zones.find(candidate => zoneMatches(destination, candidate));
  if (!zone) throw new ShippingError("We do not currently ship to this address", 409);
  const allMeasured = physicalLines.every(line => Boolean(line.weightGrams && line.heightMm && (line.packageType === "BOX" || (line.lengthMm && line.widthMm))));
  const outer = packaging.find(item => item.code === "OUTER-BOX-30X25X25") ?? null;
  const mailer = packaging.find(item => item.code === "MAILER-25X15") ?? null;
  const resolved = physicalLines.map(line => {
    const selected = line.package ?? (line.packageType === "MAILER" ? mailer : null);
    const weightGrams = line.weightGrams ?? 100;
    const lengthMm = line.packageType === "MAILER" ? selected?.lengthMm : selected?.lengthMm ?? line.lengthMm ?? 100;
    const widthMm = line.packageType === "MAILER" ? selected?.widthMm : selected?.widthMm ?? line.widthMm ?? 100;
    const heightMm = line.packageType === "MAILER" ? line.heightMm ?? 30 : selected?.heightMm ?? line.heightMm ?? 30;
    if (!weightGrams || !lengthMm || !widthMm || !heightMm || weightGrams <= 0 || lengthMm <= 0 || widthMm <= 0 || heightMm <= 0) throw new ShippingError("Shipping weight and package dimensions must be configured for every product", 409);
    if (line.packageType === "MAILER" && (!selected || (line.lengthMm && line.widthMm && !((line.lengthMm <= selected.lengthMm && line.widthMm <= selected.widthMm) || (line.widthMm <= selected.lengthMm && line.lengthMm <= selected.widthMm))))) throw new ShippingError("The product does not fit its selected shipping bag", 409);
    return { quantity: line.quantity, weightGrams, lengthMm, widthMm, heightMm, itemLengthMm: line.lengthMm ?? undefined, itemWidthMm: line.widthMm ?? undefined, packageType: line.packageType, shipsSeparately: line.shipsSeparately, selected };
  });
  if (resolved.length > 1 && resolved.some(line => line.packageType === "BOX") && !outer) throw new ShippingError("The outer shipping box is not configured", 503);
  const parcels = packCheckoutParcels(resolved, outer, mailer);
  if (parcels.some(parcel => !Number.isFinite(parcel.weightGrams) || parcel.weightGrams <= 0)) throw new ShippingError("Invalid shipping parcel", 409);
  const packagingIds = [...new Set(resolved.map(line => line.selected?.id).filter((id): id is string => Boolean(id)))];
  const rates = await db.shippingRate.findMany({
    where: {
      storeId: store.id,
      zoneId: zone.id,
      active: true,
      ...(packagingIds.length === 1 ? { OR: [{ packagingId: null }, { packagingId: packagingIds[0] }, { packaging: { code: "SMALL-PARCEL" } }] } : { OR: [{ packagingId: null }, { packaging: { code: "SMALL-PARCEL" } }] }),
      AND: [{ OR: [{ providerId: null }, { provider: { active: true, supportsRates: true } }] }],
    },
    include: { provider: true },
    orderBy: [{ priority: "desc" }, { amountCents: "asc" }],
  });
  const groups = new Map<string, typeof rates>();
  for (const rate of rates) {
    const key = rate.provider?.key ?? "manual";
    groups.set(key, [...(groups.get(key) ?? []), rate]);
  }

  const offered: ProviderRate[] = [];
  const environment = currentAppEnvironment();
  const shippitSecret = environment === "production" ? process.env.SHIPPIT_PRODUCTION_API_SECRET : environment === "staging" ? process.env.SHIPPIT_STAGING_API_SECRET : undefined;
  if (shippitSecret && allMeasured) {
    try { offered.push(...await quoteShippitParcels(destination, parcels)); }
    catch { /* Retain configured manual rates if Shippit is unavailable. */ }
  }
  for (const [providerKey, configured] of groups) {
    if (providerKey === "manual" && offered.length) continue;
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
  const packagingSnapshot = { packages: [...new Map(resolved.filter(line => line.selected).map(line => [line.selected!.id, line.selected!])).values(), ...(outer ? [outer] : [])].map(item => ({ id: item.id, code: item.code, name: item.name, lengthMm: item.lengthMm, widthMm: item.widthMm, heightMm: item.heightMm, emptyWeightGrams: item.emptyWeightGrams })), parcels };

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
