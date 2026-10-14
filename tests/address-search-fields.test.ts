import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CountryAddressFields } from "@/components/country-address-fields";

it("keeps Geoapify search separate from the actual address and browser autofill", () => {
  const html = renderToStaticMarkup(createElement(CountryAddressFields, { countries: ["AU"], autocompleteEnabled: true, initial: { line1: "100 King William Street", locality: "Adelaide", postcode: "5000" } }));
  const search = html.match(/<input[^>]+type="search"[^>]*>/)?.[0];
  expect(search).toContain('autoComplete="off"');
  expect(search).not.toMatch(/\bname=|\brequired=/);
  const street = html.match(/<input[^>]+name="line1"[^>]*>/)?.[0];
  expect(street).toContain('autoComplete="address-line1"');
  expect(street).toContain('value="100 King William Street"');
  expect(html).toContain('value="Adelaide"');
  expect(html).toContain('value="5000"');
});
it("retains manual address entry when suggestions are disabled or the country is not Australia", () => {
  for (const props of [{ countries: ["AU"], autocompleteEnabled: false }, { countries: ["NZ"], autocompleteEnabled: true }]) {
    const html = renderToStaticMarkup(createElement(CountryAddressFields, props));
    expect(html).not.toContain('type="search"');
    expect(html).toContain('name="line1"');
    expect(html).toContain('autoComplete="address-line1"');
  }
});
