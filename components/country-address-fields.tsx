"use client";

import { useState } from "react";
import { AddressSuggestions } from "@/components/address-suggestions";
import { addressFieldsForCountry } from "@/lib/address-validation";

export type CountryAddressValue = { company?: string | null; line1?: string | null; line2?: string | null; dependentLocality?: string | null; locality?: string | null; administrativeArea?: string | null; postcode?: string | null; country?: string | null; phone?: string | null };

const fallbackNames: Record<string, string> = { AU: "Australia", CO: "Colombia", US: "United States", GB: "United Kingdom", NZ: "New Zealand", CA: "Canada" };

export function CountryAddressFields({ initial, countries, includeCompany = true, includePhone = true, autocompleteEnabled = false, onAddressChange }: { initial?: CountryAddressValue | null; countries: string[]; includeCompany?: boolean; includePhone?: boolean; autocompleteEnabled?: boolean; onAddressChange?: () => void }) {
  const supported = [...new Set(countries.map(country => country.toUpperCase()).filter(country => /^[A-Z]{2}$/.test(country)))];
  const [country, setCountry] = useState(initial?.country && supported.includes(initial.country) ? initial.country : supported[0] ?? "AU");
  const [value, setValue] = useState<CountryAddressValue>(initial ?? {});
  const change = (field: keyof CountryAddressValue, next: string) => { setValue(previous => ({ ...previous, [field]: next })); onAddressChange?.(); };
  const fields = addressFieldsForCountry(country);
  const displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  return <div className="country-address-fields">
    <label className="field">Country<select name="country" value={country} autoComplete="country" onChange={event => { setCountry(event.target.value); setValue(previous => ({ ...previous, administrativeArea: "", postcode: "", locality: "", dependentLocality: "" })); onAddressChange?.(); }}>{supported.map(code => <option value={code} key={code}>{displayNames?.of(code) ?? fallbackNames[code] ?? code}</option>)}</select></label>
    {!autocompleteEnabled && <div className="manual-address-note"><strong>Enter your address</strong><span>You can always review or edit every field.</span></div>}
    {includeCompany && <label className="field">Company <span className="optional">Optional</span><input name="company" autoComplete="organization" value={value.company ?? ""} onChange={event => change("company", event.target.value)} /></label>}
    {autocompleteEnabled && country === "AU" ? <AddressSuggestions value={value.line1 ?? ""} onChange={next => change("line1", next)} onSelect={address => { setValue(previous => ({ ...previous, ...address, dependentLocality: "" })); onAddressChange?.(); }} /> : <label className="field">Street address<input name="line1" autoComplete="address-line1" value={value.line1 ?? ""} onChange={event => change("line1", event.target.value)} minLength={3} maxLength={160} required /></label>}
    <label className="field">Address line 2 <span className="optional">Optional</span><input name="line2" autoComplete="address-line2" value={value.line2 ?? ""} onChange={event => change("line2", event.target.value)} /></label>
    <label className="field">Suburb / district <span className="optional">Optional</span><input name="dependentLocality" value={value.dependentLocality ?? ""} onChange={event => change("dependentLocality", event.target.value)} /></label>
    <div className="field-grid three">
      <label className="field">{fields.localityLabel}<input name="locality" autoComplete="address-level2" value={value.locality ?? ""} onChange={event => change("locality", event.target.value)} required /></label>
      <label className="field">{fields.administrativeAreaLabel}{fields.administrativeAreas ? <select name="administrativeArea" autoComplete="address-level1" value={value.administrativeArea ?? ""} onChange={event => change("administrativeArea", event.target.value)} required={fields.administrativeAreaRequired}><option value="">Select</option>{fields.administrativeAreas.map(area => <option key={area}>{area}</option>)}</select> : <input name="administrativeArea" autoComplete="address-level1" value={value.administrativeArea ?? ""} onChange={event => change("administrativeArea", event.target.value)} required={fields.administrativeAreaRequired} />}</label>
      <label className="field">{fields.postalCodeLabel}<input name="postcode" autoComplete="postal-code" value={value.postcode ?? ""} onChange={event => change("postcode", event.target.value)} required={fields.postalCodeRequired} pattern={fields.postalCodePattern} title={country === "AU" ? "Use 4 digits, for example 5000" : country === "CO" ? "Use 6 digits" : country === "US" ? "Use 5 digits or 5+4 digits" : undefined} maxLength={20} /></label>
    </div>
    {includePhone && <label className="field">Phone <span className="optional">Optional</span><input name="phone" type="tel" autoComplete="tel" value={value.phone ?? ""} onChange={event => change("phone", event.target.value)} /></label>}
  </div>;
}
