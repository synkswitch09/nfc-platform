import { generateKeychain, type KeychainInput } from "./keychain";

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
  };
  if (Object.values(input).some(v=>typeof v!=="string")) throw new Error("Keychain options are incomplete.");
  return input as KeychainInput;
}

export function validateKeychainOptions(personalisation: unknown, selectedOptions: unknown) {
  const input=keychainInputFromOptions(personalisation,selectedOptions);
  const choices=selectedOptions as Record<string, string>;
  if (choices["keyring-hardware"] && ((input.attachment === "tag") !== (choices["keyring-hardware"] === "none"))) throw new Error("Choose hardware for the keyring loop or no hardware for a plain tag.");
  generateKeychain(input);
  return input;
}
