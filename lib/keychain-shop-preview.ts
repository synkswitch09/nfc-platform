import type { ComponentProps } from "react";
import { ProductPurchase } from "@/components/product-purchase";
import { KEYCHAIN_COLOURS, KEYCHAIN_FONTS, KEYCHAIN_SIZES } from "@/lib/keychain";

type Option = ComponentProps<typeof ProductPurchase>["options"][number];
const choice = (value: string, label: string, swatchHex: string | null = null) => ({ id: value, value, label, priceDeltaCents: 0, swatchHex, swatchHexSecondary: null, swatchImageUrl: null });

export const KEYCHAIN_PREVIEW_NAME = "Personalised 3D name keychain";
export const KEYCHAIN_PREVIEW_DESCRIPTION = "See your name take shape in real time. Choose a typeface, size and two colours for the raised lettering and backing.";

export const KEYCHAIN_PREVIEW_OPTIONS: Option[] = [
  { name: "Name", code: "keychain-name", type: "SHORT_TEXT", required: true, maxLength: 24, priceDeltaCents: 0, helpText: "The design adapts to your name and its maximum length.", values: [] },
  { name: "Font", code: "keychain-font", type: "SELECT", required: true, maxLength: null, priceDeltaCents: 0, helpText: null, values: Object.entries(KEYCHAIN_FONTS).map(([key, label]) => choice(key, label)) },
  { name: "Size", code: "keychain-size", type: "SELECT", required: true, maxLength: null, priceDeltaCents: 0, helpText: "Regular 10 mm · Medium 15 mm · Large 20 mm; long names shrink to fit.", values: Object.keys(KEYCHAIN_SIZES).map(key => choice(key, key[0].toUpperCase() + key.slice(1))) },
  { name: "Base colour", code: "base-colour", type: "COLOUR", required: true, maxLength: null, priceDeltaCents: 0, helpText: null, values: Object.entries(KEYCHAIN_COLOURS).sort(([a], [b]) => a === "peach" ? -1 : b === "peach" ? 1 : 0).map(([key, hex]) => choice(key, key[0].toUpperCase() + key.slice(1), hex)) },
  { name: "Letter colour", code: "letter-colour", type: "COLOUR", required: true, maxLength: null, priceDeltaCents: 0, helpText: "Choose a different colour from the base.", values: Object.entries(KEYCHAIN_COLOURS).map(([key, hex]) => choice(key, key[0].toUpperCase() + key.slice(1), hex)) },
];
