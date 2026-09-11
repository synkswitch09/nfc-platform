import { createHash } from "node:crypto";

export type ShippingDestination = {
  line1: string;
  line2?: string;
  suburb: string;
  state: string;
  postcode: string;
  country: "AU";
};

export type ShippingCartInput = {
  variantId: string;
  quantity: number;
  personalisationChoice?: "BASIC" | "PERSONALISED";
  personalisation?: Record<string, string>;
};

export type PhysicalLine = {
  quantity: number;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  shipsSeparately: boolean;
};

export type PackedParcel = {
  quantity: number;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
};

function stableRecord(value: Record<string, string> | undefined) {
  return Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)));
}

export function shippingCartHash(items: ShippingCartInput[]) {
  const canonical = items
    .map(item => ({ variantId: item.variantId, quantity: item.quantity, personalisationChoice: item.personalisationChoice ?? "BASIC", personalisation: stableRecord(item.personalisation) }))
    .sort((left, right) => `${left.variantId}:${left.personalisationChoice}:${JSON.stringify(left.personalisation)}`.localeCompare(`${right.variantId}:${right.personalisationChoice}:${JSON.stringify(right.personalisation)}`));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function shippingDestinationHash(destination: ShippingDestination) {
  const canonical = {
    line1: destination.line1.trim().toLowerCase(),
    line2: destination.line2?.trim().toLowerCase() ?? "",
    suburb: destination.suburb.trim().toLowerCase(),
    state: destination.state.trim().toUpperCase(),
    postcode: destination.postcode.trim(),
    country: destination.country,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function postcodeMatches(postcode: string, rules: unknown): boolean {
  if (!Array.isArray(rules) || rules.length === 0) return true;
  const numeric = Number(postcode);
  return rules.some(rule => {
    if (!rule || typeof rule !== "object") return false;
    const record = rule as Record<string, unknown>;
    const from = Number(record.from);
    const to = Number(record.to ?? record.from);
    return Number.isInteger(numeric) && Number.isInteger(from) && Number.isInteger(to) && numeric >= from && numeric <= to;
  });
}

export function zoneMatches(destination: Pick<ShippingDestination, "country" | "state" | "postcode">, zone: { countries: string[]; states: string[]; postcodeRules: unknown }) {
  return zone.countries.includes(destination.country)
    && (!zone.states.length || zone.states.includes(destination.state))
    && postcodeMatches(destination.postcode, zone.postcodeRules);
}

export function packPhysicalLines(lines: PhysicalLine[], packaging: { emptyWeightGrams: number; lengthMm: number; widthMm: number; heightMm: number }): PackedParcel[] {
  const parcels: PackedParcel[] = [];
  const combined = lines.filter(line => !line.shipsSeparately);
  if (combined.length) {
    parcels.push({
      quantity: 1,
      weightGrams: packaging.emptyWeightGrams + combined.reduce((sum, line) => sum + line.weightGrams * line.quantity, 0),
      lengthMm: Math.max(packaging.lengthMm, ...combined.map(line => line.lengthMm)),
      widthMm: Math.max(packaging.widthMm, ...combined.map(line => line.widthMm)),
      heightMm: Math.max(packaging.heightMm, combined.reduce((sum, line) => sum + line.heightMm * line.quantity, 0)),
    });
  }
  for (const line of lines.filter(line => line.shipsSeparately)) {
    parcels.push({
      quantity: line.quantity,
      weightGrams: packaging.emptyWeightGrams + line.weightGrams,
      lengthMm: Math.max(packaging.lengthMm, line.lengthMm),
      widthMm: Math.max(packaging.widthMm, line.widthMm),
      heightMm: Math.max(packaging.heightMm, line.heightMm),
    });
  }
  return parcels;
}

export function totalParcelWeight(parcels: PackedParcel[]) {
  return parcels.reduce((sum, parcel) => sum + parcel.weightGrams * parcel.quantity, 0);
}
