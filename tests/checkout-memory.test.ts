import { describe, expect, it } from "vitest";
import { checkoutMemoryKey, forgetCheckout, loadCheckout, saveCheckout } from "@/lib/checkout-memory";

function storage() { const items = new Map<string, string>(); return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); }, removeItem: (key: string) => { items.delete(key); } }; }
const details = { name: "Test Customer", email: "customer@example.test", address: { line1: "12 Example Street", locality: "Adelaide", administrativeArea: "SA", postcode: "5000", country: "AU", phone: "0400000000" } };
const now = 1000;
const day = 86_400_000;
describe("optional device checkout memory", () => {
  it("isolates stores and expires at 90 days without extending expiry when read", () => {
    const browser = storage();
    expect(saveCheckout(browser, "kosykin", details, 90, now)).toBe(true);
    expect(loadCheckout(browser, "tapkin", 90, now)).toBeNull();
    expect(loadCheckout(browser, "kosykin", 90, now + 89 * day)).toEqual(details);
    expect(loadCheckout(browser, "kosykin", 90, now + 90 * day)).toBeNull();
    expect(browser.getItem(checkoutMemoryKey("kosykin"))).toBeNull();
  });
  it("shortening retention expires old data; withdrawal removes only the current store", () => {
    const browser = storage();
    saveCheckout(browser, "kosykin", details, 90, now); saveCheckout(browser, "tapkin", details, 90, now);
    expect(loadCheckout(browser, "kosykin", 30, now + 31 * day)).toBeNull();
    expect(loadCheckout(browser, "tapkin", 90, now + 31 * day)).toEqual(details);
    forgetCheckout(browser, "tapkin"); expect(browser.getItem(checkoutMemoryKey("tapkin"))).toBeNull();
  });
  it("allowlists data and handles malformed or blocked storage without breaking checkout", () => {
    const browser = storage();
    saveCheckout(browser, "kosykin", { ...details, cardNumber: "not-to-be-saved", token: "not-to-be-saved" } as typeof details, 90, now);
    expect(browser.getItem(checkoutMemoryKey("kosykin"))).not.toContain("not-to-be-saved");
    browser.setItem(checkoutMemoryKey("kosykin"), "malformed"); expect(loadCheckout(browser, "kosykin", 90, now)).toBeNull();
    const blocked = { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } };
    expect(loadCheckout(blocked, "kosykin", 90)).toBeNull(); expect(saveCheckout(blocked, "kosykin", details, 90)).toBe(false);
    expect(saveCheckout(browser, "kosykin", details, 91)).toBe(false);
    expect(saveCheckout(browser, "kosykin", { ...details, address: { ...details.address, country: "NZ" } }, 90)).toBe(false);
  });
});
