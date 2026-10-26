import { randomInt } from "node:crypto";
type Variant = { id: string; sku: string; name: string; colour: string | null; material: string | null; trackInventory: boolean; inventory: number; reservedInventory: number; backorderPolicy: string; productionMinutes: number | null; optionSelection: unknown };
type Colour = { value: string; label: string; swatchHex: string | null };
export function availableGiftChoices(product: { variants: Variant[]; options: { code: string; values: Colour[] }[] }) {
  const choices = product.variants.flatMap(variant => {
    const inStock = variant.trackInventory && variant.inventory > variant.reservedInventory;
    const printable = Boolean(variant.productionMinutes && (!variant.trackInventory || variant.backorderPolicy === "ALLOW"));
    if (!inStock && !printable) return [];
    const option = product.options[0];
    const selection = variant.optionSelection && typeof variant.optionSelection === "object" && !Array.isArray(variant.optionSelection) ? variant.optionSelection as Record<string, unknown> : {};
    const mapped = option && typeof selection[option.code] === "string" ? selection[option.code] as string : variant.colour;
    const colours = option ? option.values.filter(colour => !mapped || [colour.value, colour.label].some(value => value.toLowerCase() === mapped.toLowerCase())) : mapped ? [{ value: mapped, label: mapped, swatchHex: null }] : [];
    return colours.map(colour => ({ variant, colour: colour.label, colourHex: colour.swatchHex, requiresPrinting: !inStock }));
  });
  const unique = new Map<string, typeof choices[number]>();
  for (const choice of choices) { const key = choice.colour.toLowerCase(); const prior = unique.get(key); if (!prior || (prior.requiresPrinting && !choice.requiresPrinting)) unique.set(key, choice); }
  return [...unique.values()];
}
export function randomGiftChoice<T>(choices: T[]): T | undefined {
  return choices.length ? choices[randomInt(choices.length)] : undefined;
}
