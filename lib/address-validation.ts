import { z } from "zod";

export type AddressFieldConfig = { localityLabel: string; administrativeAreaLabel: string; postalCodeLabel: string; administrativeAreaRequired: boolean; postalCodeRequired: boolean; postalCodePattern?: string; administrativeAreas?: string[] };

const australianStates = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const colombianDepartments = ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"];
const unitedStates = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"];

export function addressFieldsForCountry(country: string): AddressFieldConfig {
  if (country === "AU") return { localityLabel: "Suburb", administrativeAreaLabel: "State", postalCodeLabel: "Postcode", administrativeAreaRequired: true, postalCodeRequired: true, postalCodePattern: "[0-9]{4}", administrativeAreas: australianStates };
  if (country === "CO") return { localityLabel: "City / municipality", administrativeAreaLabel: "Department", postalCodeLabel: "Postal code (optional)", administrativeAreaRequired: true, postalCodeRequired: false, postalCodePattern: "[0-9]{6}", administrativeAreas: colombianDepartments };
  if (country === "US") return { localityLabel: "City", administrativeAreaLabel: "State", postalCodeLabel: "ZIP code", administrativeAreaRequired: true, postalCodeRequired: true, postalCodePattern: "[0-9]{5}(-[0-9]{4})?", administrativeAreas: unitedStates };
  if (country === "GB") return { localityLabel: "Town / city", administrativeAreaLabel: "County (optional)", postalCodeLabel: "Postcode", administrativeAreaRequired: false, postalCodeRequired: true };
  return { localityLabel: "City / locality", administrativeAreaLabel: "State / province / region (optional)", postalCodeLabel: "Postal code (optional)", administrativeAreaRequired: false, postalCodeRequired: false };
}

export const countryAddressSchema = z.object({
  company: z.string().trim().max(120).optional(),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional(),
  dependentLocality: z.string().trim().max(100).optional(),
  locality: z.string().trim().min(1).max(100),
  administrativeArea: z.string().trim().max(100).optional(),
  postcode: z.string().trim().max(20).default(""),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  phone: z.string().trim().max(40).optional(),
  formattedAddress: z.string().trim().max(1_000).optional(),
}).superRefine((value, context) => {
  const fields = addressFieldsForCountry(value.country);
  if (fields.administrativeAreaRequired && !value.administrativeArea) context.addIssue({ code: "custom", path: ["administrativeArea"], message: `${fields.administrativeAreaLabel} is required` });
  if (fields.postalCodeRequired && !value.postcode) context.addIssue({ code: "custom", path: ["postcode"], message: `${fields.postalCodeLabel} is required` });
  if (value.country === "AU" && value.postcode && !/^\d{4}$/.test(value.postcode)) context.addIssue({ code: "custom", path: ["postcode"], message: "Use a 4-digit Australian postcode" });
  if (value.country === "CO" && value.postcode && !/^\d{6}$/.test(value.postcode)) context.addIssue({ code: "custom", path: ["postcode"], message: "Use a 6-digit Colombian postal code" });
  if (value.country === "US" && value.postcode && !/^\d{5}(?:-\d{4})?$/.test(value.postcode)) context.addIssue({ code: "custom", path: ["postcode"], message: "Use a valid US ZIP code" });
});

export const addressSchema = z.object({ label: z.string().trim().max(40).optional(), recipient: z.string().trim().min(2).max(100) }).and(countryAddressSchema);

export function addressDatabaseFields(address: z.infer<typeof addressSchema>) {
  return { ...address, label: address.label || null, company: address.company || null, line2: address.line2 || null, dependentLocality: address.dependentLocality || null, administrativeArea: address.administrativeArea || null, phone: address.phone || null, formattedAddress: address.formattedAddress || null, suburb: address.locality, state: address.administrativeArea || null };
}
