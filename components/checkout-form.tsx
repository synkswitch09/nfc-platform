"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LockKeyhole, PackageCheck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { CountryAddressFields, type CountryAddressValue } from "@/components/country-address-fields";
import { CommerceAnalyticsEvent } from "@/components/commerce-analytics";
import { showFormIssues } from "@/components/form-validation-feedback";

import { forgetCheckout, loadCheckout, saveCheckout, type CheckoutDetails } from "@/lib/checkout-memory";
import { parseIntegrationConfig, type IntegrationConfig } from "@/lib/integration-config";

type CheckoutAddress = CountryAddressValue & { recipient: string };

type ShippingQuote = { token: string; providerKey: string; serviceCode: string; serviceName: string; amountCents: number; estimatedDaysMin: number | null; estimatedDaysMax: number | null; expiresAt: string };

export function CheckoutForm({ account, store, countries, integrations: configuredIntegrations, autocompleteEnabled = false }: { account: { name: string; email: string; address: CheckoutAddress | null;addresses?: (CheckoutAddress & {id:string;label:string|null;isDefault:boolean})[] } | null; store: { slug: string; displayName: string; currency: string; nfcEnabled: boolean }; countries: string[]; integrations?: IntegrationConfig; autocompleteEnabled?: boolean }) {
  const cart = useCart();
  const [addressId,setAddressId]=useState(account?.addresses?.[0]?.id??"");
  const integrations = parseIntegrationConfig(configuredIntegrations);
  const [remembered, setRemembered] = useState<CheckoutDetails | null>(null);
  const [memoryReady, setMemoryReady] = useState(false);
  const [remember, setRemember] = useState(false);
  const [hasRemembered, setHasRemembered] = useState(false);
  const [memoryRevision, setMemoryRevision] = useState(0);
  const [memoryNotice, setMemoryNotice] = useState("");
  const signedIn = Boolean(account);
  useEffect(() => {
    let saved: CheckoutDetails | null = null;
    try {
      if (!integrations.rememberCheckoutEnabled) forgetCheckout(localStorage, store.slug);
      else if (!signedIn) saved = loadCheckout(localStorage, store.slug, integrations.rememberCheckoutDays);
    } catch { /* Manual checkout remains available without browser storage. */ }
    setRemembered(saved); setRemember(Boolean(saved)); setHasRemembered(Boolean(saved)); setMemoryReady(true);
  }, [store.slug, signedIn, integrations.rememberCheckoutEnabled, integrations.rememberCheckoutDays]);
  const chosenAddress = account ? account.addresses?.find(a => a.id === addressId) ?? (account.addresses ? null : account.address) : remembered ? { ...remembered.address, recipient: remembered.name } : null;
  const addressKey = `${addressId}:${memoryRevision}:${memoryReady}`;
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const [error, setError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [pending, setPending] = useState(false);
  const [quotePending, setQuotePending] = useState(false);
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  const quoteVersion = useRef(0);
  const cartSignature = JSON.stringify(cart.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, personalisation: line.personalisation, personalisationChoice: line.personalisationChoice })));
  function invalidateDelivery() { quoteVersion.current++; setQuotes([]); setSelectedQuoteToken(""); setDeliveryError(""); setQuotePending(false); }
  useEffect(() => { invalidateDelivery(); }, [cartSignature]);
  useEffect(() => {
    const forget = () => {
      try { forgetCheckout(localStorage, store.slug); } catch { /* Browser storage unavailable. */ }
      setRemember(false); setHasRemembered(false); setRemembered(null); setMemoryRevision(value => value + 1);
      setMemoryNotice("Checkout details forgotten on this device."); invalidateDelivery();
    };
    window.addEventListener("checkout-details-forgotten", forget);
    return () => window.removeEventListener("checkout-details-forgotten", forget);
  }, [store.slug]);
  if (!cart.ready || !memoryReady) return <div className="card">Loading checkout…</div>;
  if (!cart.lines.length) return <div className="card cart-empty"><PackageCheck size={42} /><h2>Nothing to check out yet</h2><Link href="/shop" className="button">Browse products</Link></div>;
  const subtotal = cart.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const selectedQuote = quotes.find(quote => quote.token === selectedQuoteToken);
  const shipping = selectedQuote?.amountCents ?? 0;

  function addressFrom(data: FormData) {
    const optional = (name: string) => String(data.get(name) ?? "").trim() || undefined;
    return { company: optional("company"), line1: String(data.get("line1") ?? ""), line2: optional("line2"), dependentLocality: optional("dependentLocality"), locality: String(data.get("locality") ?? ""), administrativeArea: optional("administrativeArea"), postcode: String(data.get("postcode") ?? ""), country: String(data.get("country") ?? "").toUpperCase(), phone: optional("phone") };
  }

  async function calculateDelivery(form: HTMLFormElement) {
    setError(""); setDeliveryError("");
    if (!form.reportValidity()) return;
    setQuotePending(true); setQuotes([]); setSelectedQuoteToken("");
    const data = new FormData(form);
    const version = ++quoteVersion.current;
    try {
      const response = await fetch("/api/shipping/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: cart.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, personalisationChoice: line.personalisationChoice, personalisation: line.personalisation })), destination: addressFrom(data) }) });
      const result = await response.json().catch(() => ({}));
      if (version !== quoteVersion.current) return;
      if (!response.ok) { showFormIssues(form, result.issues); setDeliveryError(result.error ?? "We couldn't calculate delivery. Check the address and try again."); return; }
      const nextQuotes = Array.isArray(result.quotes) ? result.quotes as ShippingQuote[] : [];
      setQuotes(nextQuotes);
      setSelectedQuoteToken(nextQuotes[0]?.token ?? "");
      if (!nextQuotes.length) setDeliveryError("No delivery service is available for this address. Check the address or contact us.");
    } catch {
      if (version === quoteVersion.current) setDeliveryError("We couldn't connect to delivery services. Please try again in a moment.");
    } finally { if (version === quoteVersion.current) setQuotePending(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!selectedQuoteToken) { setDeliveryError("Calculate delivery for this address and choose a service before continuing."); document.querySelector(".checkout-section .country-address-fields")?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: cart.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, personalisationChoice: line.personalisationChoice, personalisation: line.personalisation })),
        shippingQuoteToken: selectedQuoteToken,
        saveAddress: data.get("saveAddress")==="on",
        promotionCode: String(data.get("promotionCode") ?? "").trim().toUpperCase() || undefined,
        customer: {
          name: data.get("name"), email: data.get("email"),
          shipping: addressFrom(data),
        },
      }),
    });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { showFormIssues(form, result.issues); setError(result.error ?? "We couldn't start checkout. Please try again."); return; }
      if (!account && integrations.rememberCheckoutEnabled) {
        try {
          if (remember) saveCheckout(localStorage, store.slug, { name: String(data.get("name") ?? ""), email: String(data.get("email") ?? ""), address: addressFrom(data) }, integrations.rememberCheckoutDays);
          else forgetCheckout(localStorage, store.slug);
        } catch { /* Remembering details is optional and must not block payment. */ }
      }
      try { sessionStorage.setItem("commerce-checkout-cart", JSON.stringify({ orderId: result.orderId, lines: cart.lines.map(line => ({ key: line.key, quantity: line.quantity })) })); } catch { /* Payment can continue when browser storage is unavailable. */ }
      window.location.assign(result.url);
    } catch {
      setError("We couldn't connect to checkout. Please try again in a moment.");
    } finally { setPending(false); }
  }

  return <form className="checkout-layout" onSubmit={submit}>
    <CommerceAnalyticsEvent store={store.slug} data={{ event: "begin_checkout", items: cart.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity })) }} />
    <div className="checkout-fields">
      {!account && <div className="guest-banner"><strong>Continue as guest</strong><span>No account is required to buy. {store.nfcEnabled ? "Create one after payment to manage connected products." : "You can create one later to manage this order."}</span></div>}
      {account && <div className="guest-banner"><strong>Signed in as {account.name}</strong><span>Your order will appear in your account after payment.</span></div>}
      <section className="checkout-section"><h2>Contact</h2><div className="field-grid"><label className="field">Full name<input name="name" autoComplete="name" key={addressKey} defaultValue={chosenAddress?.recipient ?? account?.name ?? ""} minLength={2} required /></label><label className="field">Email<input name="email" type="email" autoComplete="email" key={addressKey} defaultValue={account?.email ?? remembered?.email ?? ""} readOnly={Boolean(account)} required /></label></div></section>
      <section className="checkout-section" onChange={event => { if ((event.target as HTMLInputElement).name === "shippingQuote") return; invalidateDelivery(); }}><h2>Delivery address</h2>{Boolean(account?.addresses?.length)&&<label className="field">Saved address<select value={addressId} onChange={e=>{setAddressId(e.target.value);invalidateDelivery();}}><option value="">New address</option>{account?.addresses?.map(a=><option key={a.id} value={a.id}>{a.label??a.line1}{a.isDefault?" · Default":""}</option>)}</select></label>}<CountryAddressFields key={addressKey} initial={chosenAddress} countries={countries} autocompleteEnabled={autocompleteEnabled} onAddressChange={invalidateDelivery} />{account&&<label><input name="saveAddress" type="checkbox"/> Save this delivery address to my account</label>}<button className="button secondary" type="button" disabled={quotePending} onClick={event => calculateDelivery(event.currentTarget.form!)}>{quotePending ? "Calculating…" : "Calculate delivery"}</button>{deliveryError && <p className="form-error" role="alert">{deliveryError}</p>}{quotes.length > 0 && <fieldset className="shipping-options"><legend>Delivery service</legend>{quotes.map(quote => <label key={quote.token}><input type="radio" name="shippingQuote" value={quote.token} checked={selectedQuoteToken === quote.token} onChange={() => setSelectedQuoteToken(quote.token)} /><span><strong>{quote.serviceName}</strong><small>{quote.estimatedDaysMin ? `${quote.estimatedDaysMin}${quote.estimatedDaysMax && quote.estimatedDaysMax !== quote.estimatedDaysMin ? `–${quote.estimatedDaysMax}` : ""} business days` : "Delivery estimate shown after dispatch"}</small></span><b>{quote.amountCents ? money.format(quote.amountCents / 100) : "Free"}</b></label>)}</fieldset>}</section>
      {!account && integrations.rememberCheckoutEnabled && <section className="checkout-section"><h2>Next time</h2>
        <label className="check-field"><input type="checkbox" checked={remember} onChange={event => {
          setRemember(event.target.checked);
          if (!event.target.checked) { try { forgetCheckout(localStorage, store.slug); } catch { /* Storage unavailable. */ } setHasRemembered(false); }
        }} />Remember my details on this device for {integrations.rememberCheckoutDays} days</label>
        <p className="fine-print">When you continue to payment, save your name, email, phone and delivery address in this browser for this store. No account is created and no card details are saved. Leave this off on a shared device. This does not subscribe you to promotional emails.</p>
        {hasRemembered && <><p className="fine-print">Your previously saved details have been filled in. Please check they are still correct.</p><button className="text-button" type="button" onClick={() => window.dispatchEvent(new Event("checkout-details-forgotten"))}>Forget my saved details</button></>}
        {memoryNotice && <p role="status">{memoryNotice}</p>}
      </section>}
      <section className="checkout-section"><h2>Discount code</h2><label className="field">Code<input name="promotionCode" maxLength={32} autoComplete="off" placeholder="Optional" /></label><p className="fine-print">Eligible automatic offers and codes are applied at secure checkout. The final discounted total appears in Stripe before payment.</p></section>
      <section className="checkout-section payment-note"><LockKeyhole /><div><h2>Secure payment</h2><p>You will enter card details on Stripe Checkout. {store.displayName} never stores your card number.</p></div></section>
    </div>
    <aside className="order-summary checkout-summary"><h2>Your order</h2>{cart.lines.map(line => <p key={line.key}><span>{line.productName} × {line.quantity}</span><strong>{money.format(line.unitPriceCents * line.quantity / 100)}</strong></p>)}<p><span>Shipping</span><strong>{selectedQuote ? (shipping ? money.format(shipping / 100) : "Free") : "Calculate at address"}</strong></p><p className="summary-total"><span>Total</span><strong>{money.format((subtotal + shipping) / 100)}</strong></p>{error && <div className="form-error" role="alert">{error}</div>}<button className="button purchase-button" disabled={pending || !selectedQuote}>{pending ? "Preparing secure payment…" : "Continue to secure payment"}</button><p className="fine-print">By continuing, you agree to our <Link href="/terms"><u>terms</u></Link> and acknowledge our <Link href="/privacy"><u>privacy policy</u></Link>.</p></aside>
  </form>;
}
