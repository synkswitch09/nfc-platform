import { generateKeychain, type KeychainInput } from "./keychain";

export function keychainPaletteFromOptions(options: { code: string; values: { value: string; swatchHex: string | null }[] }[]) {
  return Object.fromEntries(options.filter(option => ["base-colour", "letter-colour"].includes(option.code)).flatMap(option => option.values.filter(item => /^#[0-9a-fA-F]{6}$/.test(item.swatchHex ?? "")).map(item => [item.value, item.swatchHex!] as const)));
}

export const KEYCHAIN_SLUG = "custom-name-keychain";
export function isKeychainProduct(storeSlug: string, productSlug: string) { return storeSlug === "kosykin" && productSlug === KEYCHAIN_SLUG; }

export function keychainInputFromOptions(personalisation: unknown, selectedOptions: unknown): KeychainInput {
  const fields = personalisation && typeof personalisation === "object" && !Array.isArray(personalisation) ? personalisation as Record<string,unknown> : {};
  const choices = selectedOptions && typeof selectedOptions === "object" && !Array.isArray(selectedOptions) ? selectedOptions as Record<string,unknown> : {};
  const input = {
    name: fields["keychain-name"], font: choices["keychain-font"], size: choices["keychain-size"],
    baseColour: choices["base-colour"], letterColour: choices["letter-colour"],
    baseShape: choices["base-shape"] ?? "contour", attachment: choices["keychain-attachment"] ?? "keychain",
    letterFinish: choices["letter-finish"] ?? "raised",
    palette: choices["base-colour-hex"] && choices["letter-colour-hex"] ? { [String(choices["base-colour"])]: String(choices["base-colour-hex"]), [String(choices["letter-colour"])]: String(choices["letter-colour-hex"]) } : undefined,
  };
  if (Object.entries(input).some(([key,v])=>key!=="palette" && typeof v!=="string")) throw new Error("Keychain options are incomplete.");
  return input as KeychainInput;
}

export function validateKeychainOptions(personalisation: unknown, selectedOptions: unknown, palette?: Record<string,string>) {
  const input={...keychainInputFromOptions(personalisation,selectedOptions), ...(palette ? {palette} : {})};
  const choices=selectedOptions as Record<string, string>;
  if (choices["keyring-hardware"] && ((input.attachment === "tag") !== (choices["keyring-hardware"] === "none"))) throw new Error("Choose hardware for the keyring loop or no hardware for a plain tag.");
  generateKeychain(input);
  return input;
}
