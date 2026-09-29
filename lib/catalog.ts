import type { CustomisationFieldType, PersonalisationChoice, PersonalisationMode } from "@prisma/client";

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

const selectionTypes = new Set<CustomisationFieldType>(["SELECT", "RADIO", "COLOUR"]);

export function resolvePersonalisationChoice(mode: PersonalisationMode, requested?: PersonalisationChoice): PersonalisationChoice {
  const resolved = requested ?? (mode === "REQUIRED" ? "PERSONALISED" : "BASIC");
  if (mode === "NONE" && resolved !== "BASIC") throw new CatalogValidationError("This product is not personalised");
  if (mode === "REQUIRED" && resolved !== "PERSONALISED") throw new CatalogValidationError("Personalisation is required for this product");
  return resolved;
}

export function normalisePersonalisation(options: CheckoutOption[], input: Record<string, string> | undefined, mode: PersonalisationMode = "REQUIRED", requestedChoice?: PersonalisationChoice) {
  const submitted = input ?? {};
  const choice = resolvePersonalisationChoice(mode, requestedChoice);
  const activeOptions = options.filter(option => option.active && (selectionTypes.has(option.type) || choice === "PERSONALISED"));
  const allowedCodes = new Set(activeOptions.map(option => option.code));
  if (Object.keys(submitted).some(code => !allowedCodes.has(code))) throw new CatalogValidationError("Unknown personalisation option");

  const personalisation: Record<string, string> = {};
  const selectedOptions: Record<string, string> = {};
  let priceDeltaCents = 0;

  for (const option of activeOptions) {
    const value = submitted[option.code]?.trim() || (option.type === "IMAGE" && choice === "PERSONALISED" ? "TO_BE_CONFIRMED" : "");
    if (option.required && !value) throw new CatalogValidationError(`${option.code} is required`);
    if (!value) continue;
    if (option.maxLength && value.length > option.maxLength) throw new CatalogValidationError(`${option.code} is too long`);

    if (selectionTypes.has(option.type)) {
      const selected = option.values.find(candidate => candidate.active && candidate.value === value);
      if (!selected) throw new CatalogValidationError(`${option.code} has an invalid value`);
      priceDeltaCents += selected.priceDeltaCents;
      selectedOptions[option.code] = value;
    } else if (option.type === "CHECKBOX") {
      if (!["true", "false"].includes(value)) throw new CatalogValidationError(`${option.code} has an invalid value`);
      personalisation[option.code] = value;
      if (value === "false") continue;
    }

    if (!selectionTypes.has(option.type)) personalisation[option.code] = value;
    priceDeltaCents += option.priceDeltaCents;
  }

  return { personalisation, selectedOptions, priceDeltaCents };
}

export function assertVariantSelection(optionSelection: unknown, selectedOptions: Record<string, string>) {
  if (!optionSelection || typeof optionSelection !== "object" || Array.isArray(optionSelection)) return;
  for (const [code, value] of Object.entries(optionSelection as Record<string, unknown>)) {
    if (typeof value !== "string" || selectedOptions[code] !== value) throw new CatalogValidationError("The selected product options do not match this variant");
  }
}

export function availableInventory(variant: { inventory: number; reservedInventory: number }) {
  return Math.max(0, variant.inventory - variant.reservedInventory);
}
