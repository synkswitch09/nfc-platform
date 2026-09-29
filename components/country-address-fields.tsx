"use client";

import { useState } from "react";
import { addressFieldsForCountry } from "@/lib/address-validation";

export type CountryAddressValue = { company?: string | null; line1?: string | null; line2?: string | null; dependentLocality?: string | null; locality?: string | null; administrativeArea?: string | null; postcode?: string | null; country?: string | null; phone?: string | null };

const fallbackNames: Record<string, string> = { AU: "Australia", CO: "Colombia", US: "United States", GB: "United Kingdom", NZ: "New Zealand", CA: "Canada" };

export function CountryAddressFields({ initial, countries, includeCompany = true, includePhone = true }: { initial?: CountryAddressValue | null; countries: string[]; includeCompany?: boolean; includePhone?: boolean }) {
  const supported = [...new Set(countries.map(country => country.toUpperCase()).filter(country => /^[A-Z]{2}$/.test(country)))];
  const [country, setCountry] = useState(initial?.country && supported.includes(initial.country) ? initial.country : supported[0] ?? "AU");
  const fields = addressFieldsForCountry(country);
  const displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  return <div className="country-address-fields">
    <label className="field">Country<select name="country" value={country} autoComplete="country" onChange={event => setCountry(event.target.value)}>{supported.map(code => <option value={code} key={code}>{displayNames?.of(code) ?? fallbackNames[code] ?? code}</option>)}</select></label>
    <div className="manual-address-note"><strong>Enter address manually</strong><span>Address suggestions are optional. You can always review or edit every field.</span></div>
    {includeCompany && <label className="field">Company <span className="optional">Optional</span><input name="company" autoComplete="organization" defaultValue={initial?.company ?? ""} /></label>}
    <label className="field">Street address<input name="line1" autoComplete="address-line1" defaultValue={initial?.line1 ?? ""} required /></label>
    <label className="field">Address line 2 <span className="optional">Optional</span><input name="line2" autoComplete="address-line2" defaultValue={initial?.line2 ?? ""} /></label>
    <label className="field">Suburb / district <span className="optional">Optional</span><input name="dependentLocality" defaultValue={initial?.dependentLocality ?? ""} /></label>
    <div className="field-grid three">
      <label className="field">{fields.localityLabel}<input name="locality" autoComplete="address-level2" defaultValue={initial?.locality ?? ""} required /></label>
      <label className="field">{fields.administrativeAreaLabel}{fields.administrativeAreas ? <select name="administrativeArea" autoComplete="address-level1" defaultValue={initial?.administrativeArea ?? ""} required={fields.administrativeAreaRequired}><option value="">Select</option>{fields.administrativeAreas.map(area => <option key={area}>{area}</option>)}</select> : <input name="administrativeArea" autoComplete="address-level1" defaultValue={initial?.administrativeArea ?? ""} required={fields.administrativeAreaRequired} />}</label>
      <label className="field">{fields.postalCodeLabel}<input name="postcode" autoComplete="postal-code" defaultValue={initial?.postcode ?? ""} required={fields.postalCodeRequired} pattern={fields.postalCodePattern} maxLength={20} /></label>
    </div>
    {includePhone && <label className="field">Phone <span className="optional">Optional</span><input name="phone" type="tel" autoComplete="tel" defaultValue={initial?.phone ?? ""} /></label>}
  </div>;
}
