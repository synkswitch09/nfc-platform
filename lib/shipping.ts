import { createHash } from "node:crypto";

export type ShippingDestination = {
  company?: string;
  line1: string;
  line2?: string;
  dependentLocality?: string;
  locality: string;
  administrativeArea?: string;
  postcode: string;
  country: string;
  phone?: string;
  formattedAddress?: string;
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
  packageType?: "BOX" | "MAILER";
  itemLengthMm?: number;
  itemWidthMm?: number;
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
    dependentLocality: destination.dependentLocality?.trim().toLowerCase() ?? "",
    locality: destination.locality.trim().toLowerCase(),
    administrativeArea: destination.administrativeArea?.trim().toUpperCase() ?? "",
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

export function zoneMatches(destination: Pick<ShippingDestination, "country" | "administrativeArea" | "postcode">, zone: { countries: string[]; states: string[]; postcodeRules: unknown }) {
  return zone.countries.includes(destination.country)
    && (!zone.states.length || Boolean(destination.administrativeArea && zone.states.includes(destination.administrativeArea)))
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

// Product shipping dimensions describe the already-packed individual item.
// Only orders with multiple units need an outer carton. Use an orthogonal
// orientation and a 5 mm clearance per axis; mixed sizes remain separate.
export function packCheckoutParcels(lines: PhysicalLine[], outer: { lengthMm: number; widthMm: number; heightMm: number; emptyWeightGrams: number; maxWeightGrams: number | null } | null, mailer: { lengthMm: number; widthMm: number; emptyWeightGrams: number; maxWeightGrams: number | null } | null = null): PackedParcel[] {
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (totalUnits === 1) {
    const line = lines[0];
    return [{ quantity: 1, weightGrams: line.weightGrams, lengthMm: line.lengthMm, widthMm: line.widthMm, heightMm: line.heightMm }];
  }
  const parcels: PackedParcel[] = [];
  for (const line of lines) {
    if (line.quantity < 1) continue;
    if (line.packageType === "MAILER") {
      if (!mailer || line.shipsSeparately) {
        parcels.push({ quantity: line.quantity, weightGrams: line.weightGrams, lengthMm: line.lengthMm, widthMm: line.widthMm, heightMm: line.heightMm });
        continue;
      }
      const itemLengthMm = line.itemLengthMm ?? line.lengthMm;
      const itemWidthMm = line.itemWidthMm ?? line.widthMm;
      const capacity = Math.max(
        Math.floor((mailer.lengthMm - 5) / itemLengthMm) * Math.floor((mailer.widthMm - 5) / itemWidthMm),
        Math.floor((mailer.lengthMm - 5) / itemWidthMm) * Math.floor((mailer.widthMm - 5) / itemLengthMm),
      );
      const weightCapacity = mailer.maxWeightGrams === null ? Infinity : Math.floor((mailer.maxWeightGrams - mailer.emptyWeightGrams) / line.weightGrams);
      const perBag = Math.max(1, Math.min(capacity, weightCapacity));
      const full = Math.floor(line.quantity / perBag);
      if (full) parcels.push({ quantity: full, weightGrams: mailer.emptyWeightGrams + perBag * line.weightGrams, lengthMm: mailer.lengthMm, widthMm: mailer.widthMm, heightMm: line.heightMm });
      const remainder = line.quantity % perBag;
      if (remainder) parcels.push({ quantity: 1, weightGrams: mailer.emptyWeightGrams + remainder * line.weightGrams, lengthMm: mailer.lengthMm, widthMm: mailer.widthMm, heightMm: line.heightMm });
      continue;
    }
    if (line.shipsSeparately || !outer) {
      parcels.push({ quantity: line.quantity, weightGrams: line.weightGrams, lengthMm: line.lengthMm, widthMm: line.widthMm, heightMm: line.heightMm });
      continue;
    }
    const [a, b, c] = [line.lengthMm, line.widthMm, line.heightMm];
    const orientations = [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]];
    const usable = [outer.lengthMm - 5, outer.widthMm - 5, outer.heightMm - 5];
    const geometricCapacity = Math.max(...orientations.map(([x,y,z]) => Math.floor(usable[0]/x) * Math.floor(usable[1]/y) * Math.floor(usable[2]/z)));
    const weightCapacity = outer.maxWeightGrams === null ? Infinity : Math.floor((outer.maxWeightGrams - outer.emptyWeightGrams) / line.weightGrams);
    const perCarton = Math.min(geometricCapacity, weightCapacity);
    if (perCarton < 2) {
      parcels.push({ quantity: line.quantity, weightGrams: line.weightGrams, lengthMm: a, widthMm: b, heightMm: c });
      continue;
    }
    const full = Math.floor(line.quantity / perCarton);
    if (full) parcels.push({ quantity: full, weightGrams: outer.emptyWeightGrams + perCarton * line.weightGrams, lengthMm: outer.lengthMm, widthMm: outer.widthMm, heightMm: outer.heightMm });
    const remainder = line.quantity % perCarton;
    if (remainder === 1) parcels.push({ quantity: 1, weightGrams: line.weightGrams, lengthMm: a, widthMm: b, heightMm: c });
    else if (remainder > 1) parcels.push({ quantity: 1, weightGrams: outer.emptyWeightGrams + remainder * line.weightGrams, lengthMm: outer.lengthMm, widthMm: outer.widthMm, heightMm: outer.heightMm });
  }
  return parcels;
}
