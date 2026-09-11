"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Radio, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { useCart } from "@/components/cart-provider";

type ProductImage = { id: string; url: string; altText: string; isPrimary: boolean; optionValueId: string | null };
type Variant = { id: string; name: string; priceCents: number; inventory: number; reservedInventory: number; trackInventory: boolean; backorderPolicy: "DENY" | "ALLOW"; isDefault: boolean; optionSelection: Record<string, string>; imageId: string | null };
type OptionValue = { id: string; label: string; value: string; priceDeltaCents: number; swatchHex: string | null; swatchHexSecondary: string | null; swatchImageUrl: string | null };
type Option = { code: string; name: string; type: string; required: boolean; maxLength: number | null; priceDeltaCents: number; helpText: string | null; values: OptionValue[] };
type Choice = "BASIC" | "PERSONALISED";

export function ProductPurchase({ productName, description, categoryName, storeName, currency, connected, personalisationMode, variants, options, images }: { productName: string; description: string; categoryName: string | null; storeName: string; currency: string; connected: boolean; personalisationMode: "NONE" | "OPTIONAL" | "REQUIRED"; variants: Variant[]; options: Option[]; images: ProductImage[] }) {
  const router = useRouter();
  const cart = useCart();
  const defaultVariant = variants.find(item => item.isDefault) ?? variants[0];
  const selectionOptions = options.filter(option => ["SELECT", "RADIO", "COLOUR"].includes(option.type));
  const customOptions = options.filter(option => !["SELECT", "RADIO", "COLOUR"].includes(option.type));
  const initialSelections = Object.fromEntries(selectionOptions.map(option => [option.code, defaultVariant?.optionSelection[option.code] ?? option.values[0]?.value ?? ""]));
  const [variantId, setVariantId] = useState(defaultVariant?.id ?? "");
  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<Choice>(personalisationMode === "REQUIRED" ? "PERSONALISED" : "BASIC");
  const [activeImageId, setActiveImageId] = useState("");
  const [error, setError] = useState("");
  const variant = variants.find(item => item.id === variantId) ?? defaultVariant;
  const colourOption = selectionOptions.find(option => option.type === "COLOUR");
  const selectedColourValue = colourOption?.values.find(value => value.value === selections[colourOption.code]);
  const gallery = (() => {
    const direct = variant?.imageId ? images.filter(image => image.id === variant.imageId) : [];
    const colour = selectedColourValue ? images.filter(image => image.optionValueId === selectedColourValue.id) : [];
    const generic = images.filter(image => !image.optionValueId);
    const relevant = colour.length ? [...direct, ...colour, ...generic] : [...direct, ...images];
    return [...new Map(relevant.map(image => [image.id, image])).values()];
  })();
  const activeImage = gallery.find(image => image.id === activeImageId) ?? gallery[0];
  const hasMappedVariants = variants.some(item => Object.keys(item.optionSelection).length > 0);
  const selectionMatchesVariant = !hasMappedVariants || Boolean(variant && Object.entries(variant.optionSelection).every(([code, selected]) => selections[code] === selected));
  const soldOut = !variant || !selectionMatchesVariant || (variant.trackInventory && variant.backorderPolicy === "DENY" && variant.inventory - variant.reservedInventory <= 0);
  const optionPriceCents = options.reduce((sum, option) => {
    const value = ["SELECT", "RADIO", "COLOUR"].includes(option.type) ? selections[option.code] : choice === "PERSONALISED" ? (option.type === "IMAGE" ? "TO_BE_CONFIRMED" : customValues[option.code]) : "";
    if (!value || value === "false") return sum;
    return sum + option.priceDeltaCents + (option.values.find(item => item.value === value)?.priceDeltaCents ?? 0);
  }, 0);

  function chooseSelection(option: Option, value: string) {
    const next = { ...selections, [option.code]: value };
    setSelections(next);
    const matching = variants.find(candidate => {
      const entries = Object.entries(candidate.optionSelection);
      return entries.length > 0 && entries.every(([code, selected]) => next[code] === selected);
    });
    if (matching) { setVariantId(matching.id); setActiveImageId(matching.imageId ?? ""); setError(""); }
    else {
      if (hasMappedVariants) setError("That option combination is currently unavailable.");
      if (option.type === "COLOUR") setActiveImageId(images.find(image => image.optionValueId === option.values.find(item => item.value === value)?.id)?.id ?? "");
    }
  }

  function chooseVariant(id: string) {
    const next = variants.find(item => item.id === id);
    setVariantId(id);
    if (next) { setSelections(current => ({ ...current, ...next.optionSelection })); setActiveImageId(next.imageId ?? ""); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!variant || soldOut) return setError(selectionMatchesVariant ? "This option is currently unavailable." : "That option combination is currently unavailable.");
    const personalisation = { ...selections, ...(choice === "PERSONALISED" ? Object.fromEntries(Object.entries(customValues).filter(([, value]) => value)) : {}) };
    cart.add({ variantId: variant.id, productName, variantName: variant.name, unitPriceCents: variant.priceCents + optionPriceCents, quantity: 1, personalisationChoice: choice, personalisation });
    router.push("/cart");
  }

  return <div className="product-layout">
    <div className="product-gallery">
      {activeImage ? <Image src={activeImage.url} alt={activeImage.altText} width={900} height={900} priority unoptimized /> : <div className="product-placeholder"><Radio size={64} /><span>{storeName}</span><strong>{productName}</strong><small>Made to order in Adelaide</small></div>}
      {gallery.length > 1 && <div className="product-thumbs">{gallery.map(image => <button type="button" key={image.id} className={image.id === activeImage?.id ? "active" : ""} onClick={() => setActiveImageId(image.id)} aria-label={`View ${image.altText}`}><Image src={image.url} alt="" width={160} height={160} unoptimized /></button>)}</div>}
    </div>
    <div className="product-copy">
      <p className="eyebrow">{categoryName ?? (connected ? "Smart NFC product" : "Made-to-order product")}</p>
      <h1>{productName}</h1>
      <p className="lead">{description}</p>
      <form className="purchase-panel" onSubmit={submit}>
        {variants.length > 1 && <label className="field">Style<select value={variant?.id ?? ""} onChange={event => chooseVariant(event.target.value)}>{variants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {selectionOptions.map(option => <SelectionField key={option.code} option={option} value={selections[option.code] ?? ""} onChange={value => chooseSelection(option, value)} />)}
        {personalisationMode === "OPTIONAL" && <fieldset className="purchase-choice"><legend>Choose your finish</legend><label><input type="radio" name="personalisationChoice" checked={choice === "BASIC"} onChange={() => { setChoice("BASIC"); setCustomValues({}); }} /><span><strong>Basic</strong><small>Standard product without custom printed details</small></span></label><label><input type="radio" name="personalisationChoice" checked={choice === "PERSONALISED"} onChange={() => setChoice("PERSONALISED")} /><span><strong>Personalised</strong><small>Add the custom details configured below</small></span></label></fieldset>}
        {choice === "PERSONALISED" && customOptions.map(option => <CustomField key={option.code} option={option} value={customValues[option.code] ?? ""} onChange={value => setCustomValues(current => ({ ...current, [option.code]: value }))} />)}
        <div className="purchase-total"><span>Price</span><strong>{variant ? new Intl.NumberFormat("en-AU", { style: "currency", currency }).format((variant.priceCents + optionPriceCents) / 100) : "Unavailable"}</strong></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button purchase-button" disabled={soldOut}>{soldOut ? (selectionMatchesVariant ? "Out of stock" : "Unavailable combination") : "Add to cart"}</button>
        <p className="fine-print">Secure checkout · Prices include GST where applicable</p>
      </form>
      <div className="trust-list">{connected && <span><ShieldCheck /> Personal data stays off the NFC chip</span>}{connected && <span><RefreshCw /> Update the profile any time</span>}<span><PackageCheck /> Made to order</span><span><Truck /> Australia-wide delivery</span></div>
    </div>
  </div>;
}

function SelectionField({ option, value, onChange }: { option: Option; value: string; onChange: (value: string) => void }) {
  if (option.type === "COLOUR") return <fieldset className="colour-options"><legend>{option.name}</legend><div>{option.values.map(item => <button type="button" key={item.id} className={value === item.value ? "active" : ""} aria-pressed={value === item.value} onClick={() => onChange(item.value)}><span className="colour-swatch" style={swatchStyle(item)} /><span>{item.label}</span>{item.priceDeltaCents > 0 && <small>+${(item.priceDeltaCents / 100).toFixed(2)}</small>}</button>)}</div>{option.helpText && <small>{option.helpText}</small>}</fieldset>;
  if (option.type === "RADIO") return <fieldset className="selection-radios"><legend>{option.name}</legend>{option.values.map(item => <label key={item.id}><input type="radio" name={option.code} value={item.value} checked={value === item.value} onChange={() => onChange(item.value)} /><span>{item.label}</span></label>)}</fieldset>;
  return <label className="field">{option.name}<select value={value} required={option.required} onChange={event => onChange(event.target.value)}><option value="" disabled>Select {option.name.toLowerCase()}</option>{option.values.map(item => <option key={item.id} value={item.value}>{item.label}{item.priceDeltaCents ? ` (+$${(item.priceDeltaCents / 100).toFixed(2)})` : ""}</option>)}</select>{option.helpText && <small>{option.helpText}</small>}</label>;
}

function CustomField({ option, value, onChange }: { option: Option; value: string; onChange: (value: string) => void }) {
  if (option.type === "CHECKBOX") return <label className="check-field"><input type="checkbox" checked={value === "true"} onChange={event => onChange(event.target.checked ? "true" : "")} required={option.required} /><span>{option.name}</span></label>;
  if (option.type === "LONG_TEXT") return <label className="field">{option.name}<textarea value={value} onChange={event => onChange(event.target.value)} required={option.required} maxLength={option.maxLength ?? undefined} />{option.helpText && <small>{option.helpText}</small>}</label>;
  if (option.type === "IMAGE") return <div className="notice">Image personalisation for {option.name} will be confirmed after purchase.</div>;
  return <label className="field">{option.name}<input value={value} onChange={event => onChange(event.target.value)} required={option.required} maxLength={option.maxLength ?? undefined} />{option.maxLength && <small>Maximum {option.maxLength} characters</small>}{option.helpText && <small>{option.helpText}</small>}</label>;
}

function swatchStyle(value: OptionValue) {
  if (value.swatchImageUrl) return { backgroundImage: `url(${value.swatchImageUrl})` };
  if (value.swatchHexSecondary) return { background: `linear-gradient(135deg, ${value.swatchHex ?? "#cccccc"} 50%, ${value.swatchHexSecondary} 50%)` };
  return { background: value.swatchHex ?? "#cccccc" };
}
