import { generateKeychain, type KeychainInput } from "./keychain";

export const KEYCHAIN_SLUG = "custom-name-keychain";
export function isKeychainProduct(storeSlug: string, productSlug: string) { return storeSlug === "kosykin" && productSlug === KEYCHAIN_SLUG; }

export function keychainInputFromOptions(personalisation: unknown, selectedOptions: unknown): KeychainInput {
  const fields = personalisation && typeof personalisation === "object" && !Array.isArray(personalisation) ? personalisation as Record<string,unknown> : {};
  const choices = selectedOptions && typeof selectedOptions === "object" && !Array.isArray(selectedOptions) ? selectedOptions as Record<string,unknown> : {};
  const input = {
    name: fields["keychain-name"], font: choices["keychain-font"], size: choices["keychain-size"],
    baseColour: choices["base-colour"], letterColour: choices["letter-colour"],
  };
  if (Object.values(input).some(v=>typeof v!=="string")) throw new Error("Keychain options are incomplete.");
  return input as KeychainInput;
}

export function validateKeychainOptions(personalisation: unknown, selectedOptions: unknown) {
  const input=keychainInputFromOptions(personalisation,selectedOptions);
  generateKeychain(input);
  return input;
}
