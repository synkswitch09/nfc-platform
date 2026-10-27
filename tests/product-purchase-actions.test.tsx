import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProductPurchase } from "@/components/product-purchase";
const mocks = vi.hoisted(() => ({ add: vi.fn(), push: vi.fn(), ready: true }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useEffect: vi.fn(), useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()] }));
vi.mock("@/components/cart-provider", () => ({ useCart: () => ({ add: mocks.add, ready: mocks.ready }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
const props: React.ComponentProps<typeof ProductPurchase> = { productId: "stand", productName: "Wavy Stand", productSlug: "wavy-stand", storeSlug: "kosykin", storeName: "Kosykin", currency: "AUD", description: "Phone stand", categoryName: "Stands & Holders", checkoutEnabled: true, connected: false, personalisationMode: "NONE", images: [], variants: [{ id: "pink", name: "Pink", priceCents: 2995, inventory: 0, reservedInventory: 0, trackInventory: false, backorderPolicy: "DENY", isDefault: true, optionSelection: { colour: "pink" }, imageId: null, modelUrl: null, canOrder: true }], options: [{ code: "colour", name: "Colour", type: "COLOUR", required: true, maxLength: null, priceDeltaCents: 0, helpText: null, values: [{ id: "pink", label: "Pink", value: "pink", priceDeltaCents: 0, swatchHex: "#F7CED7", swatchHexSecondary: null, swatchImageUrl: null }] }] };
function findForm(node: React.ReactNode): React.ReactElement<{ onSubmit: (event: unknown) => void }> | undefined {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return;
  if (node.type === "form") return node as React.ReactElement<{ onSubmit: (event: unknown) => void }>;
  for (const child of React.Children.toArray(node.props.children)) { const found = findForm(child); if (found) return found; }
}
class Button { constructor(public value: string) {} }
function submit(action: string, extra: Partial<typeof props> = {}) {
  vi.stubGlobal("HTMLButtonElement", Button);
  const form = findForm(ProductPurchase({ ...props, ...extra }));
  expect(form).toBeDefined();
  form!.props.onSubmit({ preventDefault: vi.fn(), nativeEvent: { submitter: new Button(action) } });
}
beforeEach(() => { vi.clearAllMocks(); mocks.ready = true; });
describe("product purchase actions", () => {
  it("adds the chosen variant and options before navigating to checkout for Buy now", () => {
    submit("BUY_NOW");
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ variantId: "pink", quantity: 1, unitPriceCents: 2995, personalisation: { colour: "pink" } }));
    expect(mocks.push).toHaveBeenCalledWith("/checkout");
    expect(mocks.add.mock.invocationCallOrder[0]).toBeLessThan(mocks.push.mock.invocationCallOrder[0]);
  });
  it("keeps Add to cart on the product page", () => {
    submit("ADD_TO_CART");
    expect(mocks.add).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it.each(["closed", "unavailable", "loading"])("cannot bypass %s checkout restrictions through Buy now", mode => {
    if (mode === "loading") mocks.ready = false;
    submit("BUY_NOW", mode === "closed" ? { checkoutEnabled: false } : mode === "unavailable" ? { variants: [{ ...props.variants[0], canOrder: false }] } : {});
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
