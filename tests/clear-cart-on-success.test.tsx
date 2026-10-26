import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ effects: [] as (() => unknown)[], removePurchased: vi.fn(), ready: true, refresh: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useEffect: (effect: () => unknown) => { m.effects.push(effect); } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/components/cart-provider", () => ({ useCart: () => ({ ready: m.ready, removePurchased: m.removePurchased }) }));
import { ClearCartOnSuccess } from "@/components/clear-cart-on-success";
const local = new Map<string, string>(), session = new Map<string, string>();
const storage = (data: Map<string, string>) => ({ getItem: (key: string) => data.get(key) ?? null, removeItem: (key: string) => data.delete(key) });
beforeEach(() => {
  vi.clearAllMocks(); m.effects = []; m.ready = true; local.clear(); session.clear();
  vi.stubGlobal("localStorage", storage(local)); vi.stubGlobal("sessionStorage", storage(session));
});
function complete(paid = true) {
  m.effects = [];
  renderToStaticMarkup(<ClearCartOnSuccess orderId="order" paid={paid} />);
  // The second effect performs cleanup; the first only polls payment confirmation.
  m.effects[1]();
}
it("cleans purchased quantities after payment even when Stripe returns in another tab", () => {
  const lines = [{ key: "blue:BASIC:[]", quantity: 1 }];
  local.set("commerce-checkout-cart:order", JSON.stringify({ orderId: "order", lines }));
  complete();
  expect(m.removePurchased).toHaveBeenCalledWith(lines);
  complete();
  expect(m.removePurchased).toHaveBeenCalledTimes(1);
});
it("waits for account cart hydration and never clears abandoned or mismatched checkouts", () => {
  session.set("commerce-checkout-cart", JSON.stringify({ orderId: "order", lines: [{ key: "blue", quantity: 1 }] }));
  m.ready = false; complete();
  m.ready = true; complete(false);
  expect(m.removePurchased).not.toHaveBeenCalled();
  expect(session.size).toBe(1);
  session.set("commerce-checkout-cart", JSON.stringify({ orderId: "other", lines: [] }));
  complete();
  expect(m.removePurchased).not.toHaveBeenCalled();
});
