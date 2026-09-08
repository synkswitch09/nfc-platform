"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";

type Variant = { id: string; name: string; priceCents: number; inventory: number; reservedInventory: number; trackInventory: boolean; backorderPolicy: "DENY" | "ALLOW" };
type Option = { code: string; name: string; type: string; required: boolean; maxLength: number | null; priceDeltaCents: number; helpText: string | null; values: Array<{ label: string; value: string; priceDeltaCents: number }> };

export function ProductPurchase({ productName, variants, options }: { productName: string; variants: Variant[]; options: Option[] }) {
  const router = useRouter();
  const cart = useCart();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [error, setError] = useState("");
  const variant = useMemo(() => variants.find(item => item.id === variantId), [variantId, variants]);
  const soldOut = !variant || (variant.trackInventory && variant.backorderPolicy === "DENY" && variant.inventory - variant.reservedInventory <= 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!variant || soldOut) return setError("This option is currently unavailable.");
    const form = new FormData(event.currentTarget);
    const personalisation: Record<string, string> = {};
    let priceDeltaCents = 0;
    for (const option of options) {
      const raw = form.get(option.code);
      const value = option.type === "CHECKBOX" ? (raw === "true" ? "true" : "") : String(raw ?? "").trim();
      if (value) personalisation[option.code] = value;
      const selected = option.values.find(item => item.value === value);
      if (value) priceDeltaCents += option.priceDeltaCents + (selected?.priceDeltaCents ?? 0);
    }
    cart.add({ variantId: variant.id, productName, variantName: variant.name, unitPriceCents: variant.priceCents + priceDeltaCents, quantity: 1, personalisation });
    router.push("/cart");
  }

  return <form className="purchase-panel" onSubmit={submit}>
    {variants.length > 1 && <label className="field">Style<select value={variantId} onChange={event => setVariantId(event.target.value)}>{variants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {options.map(option => <OptionField key={option.code} option={option} />)}
    <div className="purchase-total"><span>Price</span><strong>{variant ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(variant.priceCents / 100) : "Unavailable"}</strong></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button purchase-button" disabled={soldOut}>{soldOut ? "Out of stock" : "Add to cart"}</button>
    <p className="fine-print">Secure checkout · Prices include GST where applicable</p>
  </form>;
}

function OptionField({ option }: { option: Option }) {
  if (["SELECT", "RADIO", "COLOUR"].includes(option.type)) return <label className="field">{option.name}<select name={option.code} required={option.required} defaultValue=""><option value="" disabled>Select {option.name.toLowerCase()}</option>{option.values.map(value => <option key={value.value} value={value.value}>{value.label}{value.priceDeltaCents ? ` (+$${(value.priceDeltaCents / 100).toFixed(2)})` : ""}</option>)}</select>{option.helpText && <small>{option.helpText}</small>}</label>;
  if (option.type === "CHECKBOX") return <label className="check-field"><input type="checkbox" name={option.code} value="true" required={option.required} /><span>{option.name}</span></label>;
  if (option.type === "LONG_TEXT") return <label className="field">{option.name}<textarea name={option.code} required={option.required} maxLength={option.maxLength ?? undefined} /></label>;
  if (option.type === "IMAGE") return <div className="notice">Image personalisation for {option.name} will be confirmed after purchase.</div>;
  return <label className="field">{option.name}<input name={option.code} required={option.required} maxLength={option.maxLength ?? undefined} />{option.maxLength && <small>Maximum {option.maxLength} characters</small>}</label>;
}
