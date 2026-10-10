"use client";

import { emitCommerceEvent, sendCommerceEvent } from "@/lib/measurement-client";
import {FavouriteButton} from "@/components/favourite-button";
import Image from "next/image";
import { createElement, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PackageCheck, Radio, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { keychainPaletteFromOptions } from "@/lib/keychain-order";
import { KeychainPreview } from "@/components/keychain-preview";
import { generateKeychain, type KeychainAttachment, type KeychainBaseShape, type KeychainFont, type KeychainLetterFinish, type KeychainSize } from "@/lib/keychain";
import { KeychainFontSample, KeyringSample } from "@/components/keychain-option-samples";

type ProductImage = { id: string; url: string; altText: string; isPrimary: boolean; optionValueId: string | null; variantId: string | null };
type ProductVideo = { id: string; url: string; caption: string; variantId: string };
type Variant = { id: string; name: string; canOrder: boolean; priceCents: number; inventory: number; reservedInventory: number; trackInventory: boolean; backorderPolicy: "DENY" | "ALLOW"; isDefault: boolean; optionSelection: Record<string, string>; imageId: string | null; modelUrl: string | null };
type OptionValue = { id: string; label: string; value: string; priceDeltaCents: number; swatchHex: string | null; swatchHexSecondary: string | null; swatchImageUrl: string | null };
type Option = { code: string; name: string; type: string; required: boolean; maxLength: number | null; priceDeltaCents: number; helpText: string | null; values: OptionValue[] };
type Choice = "BASIC" | "PERSONALISED";

export function ProductPurchase({ checkoutEnabled, previewOnly = false, productName, productSlug, productId, storeSlug, description, categoryName, storeName, currency, connected, personalisationMode, variants, options, images, videos = [], initialColour = "", initialVariantId = "" }: { checkoutEnabled: boolean; previewOnly?: boolean; productName: string; productSlug: string; productId: string; storeSlug: string; description: string; categoryName: string | null; storeName: string; currency: string; connected: boolean; personalisationMode: "NONE" | "OPTIONAL" | "REQUIRED"; variants: Variant[]; options: Option[]; images: ProductImage[]; videos?: ProductVideo[]; initialColour?: string; initialVariantId?: string }) {
  const cart = useCart();
  useEffect(() => { if (storeSlug === "kosykin" && productSlug === "custom-name-keychain" && !previewOnly) void sendCommerceEvent(storeSlug, { event: "personalizer_interaction", productId, action: "open" }); }, [storeSlug, productSlug, productId, previewOnly]);
  const defaultVariant = variants.find(item => item.id === initialVariantId) ?? variants.find(item => item.isDefault) ?? variants[0];
  const selectionOptions = options.filter(option => ["SELECT", "RADIO", "COLOUR"].includes(option.type));
  const customOptions = options.filter(option => !["SELECT", "RADIO", "COLOUR"].includes(option.type));
  const initialSelections = Object.fromEntries(selectionOptions.map(option => [option.code, defaultVariant?.optionSelection[option.code] ?? option.values[0]?.value ?? ""]));
  const initialColourOption = selectionOptions.find(option => option.type === "COLOUR" && option.values.some(value => value.value === initialColour));
  const initialVariant = variants.find(candidate => initialColourOption && candidate.optionSelection[initialColourOption.code] === initialColour) ?? defaultVariant;
  const [variantId, setVariantId] = useState(initialVariant?.id ?? "");
  const [selections, setSelections] = useState<Record<string, string>>(() => ({ ...initialSelections, ...(selectionOptions.some(option => option.type === "COLOUR" && option.values.some(value => value.value === initialColour)) ? { [selectionOptions.find(option => option.type === "COLOUR")!.code]: initialColour } : {}) }));
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => storeSlug === "kosykin" && productSlug === "custom-name-keychain" ? { "keychain-name": "Name" } : {} as Record<string, string>);
  const [choice, setChoice] = useState<Choice>(personalisationMode === "REQUIRED" ? "PERSONALISED" : "BASIC");
  const [activeImageId, setActiveImageId] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [view3d, setView3d] = useState(false);
  const isKeychain = storeSlug === "kosykin" && productSlug === "custom-name-keychain";
  const selectedSize = (selections["keychain-size"] ?? "regular") as KeychainSize;
  const keychainPalette = useMemo(() => keychainPaletteFromOptions(options), [options]);
  const keychainInput = { palette: keychainPalette, name: customValues["keychain-name"] ?? "", font: (selections["keychain-font"] ?? "rounded") as KeychainFont, size: selectedSize, baseShape: (selections["base-shape"] ?? "contour") as KeychainBaseShape, attachment: (selections["keychain-attachment"] ?? "keychain") as KeychainAttachment, letterFinish: (selections["letter-finish"] ?? "raised") as KeychainLetterFinish, baseColour: selections["base-colour"] ?? "peach", letterColour: selections["letter-colour"] ?? "white" };
  let keychainError = "";
  if (isKeychain && customValues["keychain-name"]) { try { generateKeychain(keychainInput); } catch (cause) { keychainError = cause instanceof Error ? cause.message : "Invalid name"; } }
  const variant = variants.find(item => item.id === variantId) ?? defaultVariant;
  useEffect(() => { if (view3d && variant?.modelUrl) void import("@google/model-viewer"); }, [view3d, variant?.modelUrl]);
  const colourOption = selectionOptions.find(option => option.type === "COLOUR");
  const selectedColourValue = colourOption?.values.find(value => value.value === selections[colourOption.code]);
  const gallery = (() => {
    const direct = variant ? images.filter(image => image.variantId === variant.id || image.id === variant.imageId) : [];
    const colour = selectedColourValue ? images.filter(image => !image.variantId && image.optionValueId === selectedColourValue.id) : [];
    const generic = images.filter(image => !image.optionValueId && !image.variantId);
    const relevant = direct.length || colour.length ? [...direct, ...colour, ...generic] : [...generic, ...images.filter(image => !image.variantId)];
    return [...new Map(relevant.map(image => [image.id, image])).values()];
  })();
  const activeImage = gallery.find(image => image.id === activeImageId) ?? gallery[0];
  const variantVideos = videos.filter(video => video.variantId === variant?.id);
  const activeVideo = variantVideos.find(video => video.id === activeImageId);
  const hasMappedVariants = variants.some(item => Object.keys(item.optionSelection).length > 0);
  const selectionMatchesVariant = !hasMappedVariants || Boolean(variant && Object.entries(variant.optionSelection).every(([code, selected]) => selections[code] === selected));
  const soldOut = !variant || !selectionMatchesVariant || (!variant.canOrder);
  const optionPriceCents = options.reduce((sum, option) => {
    if (variant && option.code in variant.optionSelection) return sum;
    const value = ["SELECT", "RADIO", "COLOUR"].includes(option.type) ? selections[option.code] : choice === "PERSONALISED" ? (option.type === "IMAGE" ? "TO_BE_CONFIRMED" : customValues[option.code]) : "";
    if (!value || value === "false") return sum;
    return sum + option.priceDeltaCents + (option.values.find(item => item.value === value)?.priceDeltaCents ?? 0);
  }, 0);

  function chooseSelection(option: Option, value: string) {
    if (isKeychain) {
      const field = option.type === "COLOUR" ? "colour" : option.code.includes("font") ? "font" : option.code.includes("size") ? "size" : option.code.includes("finish") ? "finish" : option.code.includes("attachment") || option.code.includes("hardware") ? "attachment" : "shape";
      emitCommerceEvent({ event: "personalizer_interaction", productId, action: "change", field });
    }
    const next = { ...selections, [option.code]: value };
    if (option.code === "keychain-attachment") next["keyring-hardware"] = value === "tag" ? "none" : (selections["keyring-hardware"] === "none" ? options.find(item => item.code === "keyring-hardware")?.values.find(item => item.value !== "none")?.value ?? "" : selections["keyring-hardware"]);
    setSelections(next);
    setView3d(false);
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
    setView3d(false);
    if (next) { setSelections(current => ({ ...current, ...next.optionSelection })); setActiveImageId(next.imageId ?? ""); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!checkoutEnabled) return setError("Orders are not open yet.");
    if (isKeychain) { try { generateKeychain({ ...keychainInput, name: customValues["keychain-name"] ?? "" }); } catch (cause) { return setError(cause instanceof Error ? cause.message : "Invalid keychain name"); } }
    if (!variant || soldOut) return setError(selectionMatchesVariant ? "This option is currently unavailable." : "That option combination is currently unavailable.");
    const personalisation = { ...selections, ...(choice === "PERSONALISED" ? Object.fromEntries(Object.entries(customValues).filter(([, value]) => value)) : {}) };
    cart.add({ variantId: variant.id, productName, variantName: variant.name, unitPriceCents: variant.priceCents + optionPriceCents, quantity: 1, personalisationChoice: choice, personalisation });
    setAdded(true);
  }

  return <div className="product-layout">
    <div className="product-gallery">
      {!isKeychain && view3d && variant?.modelUrl ? createElement("model-viewer", { src: variant.modelUrl, "camera-controls": true, "interaction-prompt": "auto", alt: `Rotate ${productName} in 3D`, className: "product-model-viewer" }) : activeVideo ? <video key={activeVideo.id} className="product-gallery-video" src={activeVideo.url} controls playsInline preload="metadata" aria-label={activeVideo.caption} /> : isKeychain && choice === "PERSONALISED" && !activeImageId ? <KeychainPreview input={keychainInput} /> : activeImage ? <Image src={activeImage.url} alt={activeImage.altText} width={900} height={900} priority unoptimized /> : <div className="product-placeholder"><Radio size={64} /><span>{storeName}</span><strong>{productName}</strong><small>Made to order in Adelaide</small></div>}
      <div className="gallery-price" aria-live="polite">{previewOnly ? "Pricing coming soon" : variant ? new Intl.NumberFormat("en-AU", { style: "currency", currency }).format((variant.priceCents + optionPriceCents) / 100) : "Unavailable"}</div>
      {(gallery.length > 1 || variantVideos.length > 0 || Boolean(variant?.modelUrl) || isKeychain && gallery.length > 0) && <div className="product-thumbs">{isKeychain && <button type="button" className={!activeImageId ? "active" : ""} onClick={() => { setActiveImageId(""); setView3d(false); if (!previewOnly) emitCommerceEvent({ event: "personalizer_interaction", productId, action: "preview", field: "preview" }); }} aria-label="View personalised 3D preview"><span className="product-media-thumb">3D<small>Preview</small></span></button>}{gallery.map(image => <button type="button" key={image.id} className={!view3d && !activeVideo && image.id === activeImageId ? "active" : ""} onClick={() => { setActiveImageId(image.id); setView3d(false); }} aria-label={`View ${image.altText}`}><Image src={image.url} alt="" width={160} height={160} unoptimized /></button>)}{variantVideos.map(video => <button type="button" key={video.id} className={activeVideo?.id === video.id && !view3d ? "active" : ""} onClick={() => { setActiveImageId(video.id); setView3d(false); }} aria-label={`Play ${video.caption}`}><span className="product-media-thumb">▶<small>Video</small></span></button>)}{variant?.modelUrl && <button type="button" className={view3d ? "active" : ""} onClick={() => { setView3d(true); setActiveImageId(""); }} aria-label="View product in 3D"><span className="product-media-thumb">3D<small>Rotate</small></span></button>}</div>}
    </div>
    <div className="product-copy">
      <p className="eyebrow">{categoryName ?? (connected ? "Smart NFC product" : "Made-to-order product")}</p>
      <h1>{productName}</h1><FavouriteButton slug={productSlug}/>
      <p className="lead">{description}</p>
      <form className="purchase-panel" onSubmit={submit} onBlur={event => { if (isKeychain && !previewOnly && event.target instanceof HTMLInputElement && event.target.type === "text") emitCommerceEvent({ event: "personalizer_interaction", productId, action: "change", field: "text" }); }}>
        {variants.length > 1 && !hasMappedVariants && <label className="field">Variant<select value={variant?.id ?? ""} onChange={event => chooseVariant(event.target.value)}>{variants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {selectionOptions.filter(option => option.code !== "keyring-hardware" || selections["keychain-attachment"] === "keychain").map(option => <SelectionField key={option.code} option={isKeychain && option.code === "letter-finish" ? { ...option, helpText: "Raised: 2.6 mm base + 1.4 mm letters (4 mm total). Flush: 2.6 mm total." } : option} value={selections[option.code] ?? ""} onChange={value => chooseSelection(option, value)} />)}
        {personalisationMode === "OPTIONAL" && <fieldset className="purchase-choice"><legend>Choose your finish</legend><label><input type="radio" name="personalisationChoice" checked={choice === "BASIC"} onChange={() => { setChoice("BASIC"); setCustomValues({}); }} /><span><strong>Basic</strong><small>Standard product without custom printed details</small></span></label><label><input type="radio" name="personalisationChoice" checked={choice === "PERSONALISED"} onChange={() => setChoice("PERSONALISED")} /><span><strong>Personalised</strong><small>Add the custom details configured below</small></span></label></fieldset>}
        {choice === "PERSONALISED" && customOptions.map(option => <CustomField key={option.code} option={option} value={customValues[option.code] ?? ""} onChange={value => { setCustomValues(current => ({ ...current, [option.code]: value })); }} />)}
        {keychainError && <p className="form-error" role="status">{keychainError}</p>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button purchase-button" disabled={previewOnly || !checkoutEnabled || soldOut || Boolean(keychainError)}>{previewOnly ? "Preview only · orders closed" : !checkoutEnabled ? "Orders opening soon" : soldOut ? (selectionMatchesVariant ? "Out of stock" : "Unavailable combination") : "Add to cart"}</button>
        {added && <div className="cart-added" role="status"><strong>Added to your cart</strong><div><button type="button" className="button secondary" onClick={() => setAdded(false)}>Continue shopping</button><Link className="button" href="/checkout">Checkout</Link></div></div>}
        <p className="fine-print">{previewOnly ? "Explore the design here in the Shop. Pricing and ordering will follow." : checkoutEnabled ? "Secure checkout · Prices include GST where applicable" : "Products are visible while orders are closed."}</p>
      </form>
      <div className="trust-list">{connected && <span><ShieldCheck /> Personal data stays off the NFC chip</span>}{connected && <span><RefreshCw /> Update the profile any time</span>}<span><PackageCheck /> Made to order</span><span><Truck /> Australia-wide delivery</span></div>
    </div>
  </div>;
}

function SelectionField({ option, value, onChange }: { option: Option; value: string; onChange: (value: string) => void }) {
  if (option.code === "keychain-font" || option.code === "keyring-hardware") return <fieldset className="keychain-option-field"><legend>{option.name}</legend><div className={`keychain-option-grid ${option.code === "keyring-hardware" ? "hardware-grid" : ""}`}>{option.values.filter(item => option.code !== "keyring-hardware" || item.value !== "none").map(item => <button type="button" key={item.id} className={`keychain-option-card${value === item.value ? " active" : ""}`} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{option.code === "keychain-font" ? <KeychainFontSample font={item.value} /> : <KeyringSample value={item.value} imageUrl={item.swatchImageUrl} />}<span>{item.label}</span>{item.priceDeltaCents > 0 && <small>+${(item.priceDeltaCents / 100).toFixed(2)}</small>}</button>)}</div>{option.helpText && <small>{option.helpText}</small>}</fieldset>;
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
