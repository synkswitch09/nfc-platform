import type { ShippingDestination } from "@/lib/shipping";

export type AddressSuggestion = { id: string; label: string };
export interface AddressAutocompleteProvider {
  readonly key: string;
  suggest(query: string, country: string): Promise<AddressSuggestion[]>;
  resolve(id: string): Promise<ShippingDestination>;
}

export class ManualAddressProvider implements AddressAutocompleteProvider {
  readonly key = "manual";
  async suggest(query: string, country: string) { void query; void country; return []; }
  async resolve(id: string): Promise<ShippingDestination> { void id; throw new Error("Manual address entry does not resolve provider suggestions"); }
}
