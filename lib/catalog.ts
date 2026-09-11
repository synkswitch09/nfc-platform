import type { CustomisationFieldType } from "@prisma/client";

type OptionValue = { value: string; active: boolean; priceDeltaCents: number };
export type CheckoutOption = {
  code: string;
  type: CustomisationFieldType;
  required: boolean;
  maxLength: number | null;
  priceDeltaCents: number;
  active: boolean;
  values: OptionValue[];
};

export class CatalogValidationError extends Error {}

export function normalisePersonalisation(options: CheckoutOption[], input: Record<string, string> | undefined) {
  const submitted = input ?? {};
  const activeOptions = options.filter(option => option.active);
  const allowedCodes = new Set(activeOptions.map(option => option.code));
  if (Object.keys(submitted).some(code => !allowedCodes.has(code))) throw new CatalogValidationError("Unknown personalisation option");

  const personalisation: Record<string, string> = {};
  const selectedOptions: Record<string, string> = {};
  let priceDeltaCents = 0;

  for (const option of activeOptions) {
    const value = submitted[option.code]?.trim() ?? "";
    if (option.required && !value) throw new CatalogValidationError(`${option.code} is required`);
    if (!value) continue;
    if (option.maxLength && value.length > option.maxLength) throw new CatalogValidationError(`${option.code} is too long`);

    if (["SELECT", "RADIO", "COLOUR"].includes(option.type)) {
      const selected = option.values.find(candidate => candidate.active && candidate.value === value);
      if (!selected) throw new CatalogValidationError(`${option.code} has an invalid value`);
      priceDeltaCents += selected.priceDeltaCents;
      selectedOptions[option.code] = value;
    } else if (option.type === "CHECKBOX") {
      if (!["true", "false"].includes(value)) throw new CatalogValidationError(`${option.code} has an invalid value`);
      personalisation[option.code] = value;
      if (value === "false") continue;
    }

    if (!["SELECT", "RADIO", "COLOUR"].includes(option.type)) personalisation[option.code] = value;
    priceDeltaCents += option.priceDeltaCents;
  }

  return { personalisation, selectedOptions, priceDeltaCents };
}

export function availableInventory(variant: { inventory: number; reservedInventory: number }) {
  return Math.max(0, variant.inventory - variant.reservedInventory);
}
