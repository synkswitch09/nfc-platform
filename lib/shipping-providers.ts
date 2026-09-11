import type { ShippingProviderKind } from "@prisma/client";
import type { PackedParcel, ShippingDestination } from "@/lib/shipping";

export type ProviderRate = {
  providerKey: string;
  serviceCode: string;
  serviceName: string;
  amountCents: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
};

export type RateRequest = {
  destination: ShippingDestination;
  parcels: PackedParcel[];
  subtotalCents: number;
  currency: string;
};

export type ConfiguredRate = ProviderRate & {
  freeOverCents: number | null;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
};

export interface ShippingProviderAdapter {
  readonly kind: ShippingProviderKind;
  quote(request: RateRequest, configuredRates: ConfiguredRate[]): Promise<ProviderRate[]>;
}

class ConfiguredRateProvider implements ShippingProviderAdapter {
  constructor(readonly kind: ShippingProviderKind) {}

  async quote(request: RateRequest, configuredRates: ConfiguredRate[]) {
    const weight = request.parcels.reduce((sum, parcel) => sum + parcel.weightGrams * parcel.quantity, 0);
    return configuredRates
      .filter(rate => (rate.minWeightGrams === null || weight >= rate.minWeightGrams)
        && (rate.maxWeightGrams === null || weight <= rate.maxWeightGrams))
      .map(rate => ({
        providerKey: rate.providerKey,
        serviceCode: rate.serviceCode,
        serviceName: rate.serviceName,
        amountCents: rate.freeOverCents !== null && request.subtotalCents >= rate.freeOverCents ? 0 : rate.amountCents,
        estimatedDaysMin: rate.estimatedDaysMin,
        estimatedDaysMax: rate.estimatedDaysMax,
      }));
  }
}

class AustraliaPostProvider implements ShippingProviderAdapter {
  readonly kind = "AUSTRALIA_POST" as const;
  async quote(): Promise<ProviderRate[]> {
    throw new Error("Australia Post live rates require an approved account and adapter credentials");
  }
}

export function shippingProviderAdapter(kind: ShippingProviderKind): ShippingProviderAdapter {
  if (kind === "AUSTRALIA_POST") return new AustraliaPostProvider();
  return new ConfiguredRateProvider(kind);
}
