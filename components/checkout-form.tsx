"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LockKeyhole, PackageCheck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { CountryAddressFields, type CountryAddressValue } from "@/components/country-address-fields";
import { CommerceAnalyticsEvent } from "@/components/commerce-analytics";
import { showFormIssues } from "@/components/form-validation-feedback";

type CheckoutAddress = CountryAddressValue & { recipient: string };

type ShippingQuote = { token: string; providerKey: string; serviceCode: string; serviceName: string; amountCents: number; estimatedDaysMin: number | null; estimatedDaysMax: number | null; expiresAt: string };

export function CheckoutForm({ account, store, countries }: { account: { name: string; email: string; address: CheckoutAddress | null;addresses?: (CheckoutAddress & {id:string;label:string|null;isDefault:boolean})[] } | null; store: { slug: string; displayName: string; currency: string; nfcEnabled: boolean }; countries: string[] }) {
  const cart = useCart();
  const [addressId,setAddressId]=useState(account?.addresses?.[0]?.id??"");
  const chosenAddress=account?.addresses?.find(a=>a.id===addressId)??(account?.addresses?null:account?.address);
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const [error, setError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [pending, setPending] = useState(false);
  const [quotePending, setQuotePending] = useState(false);
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  if (!cart.ready) return <div className="card">Loading checkout…</div>;
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
    try {
      const response = await fetch("/api/shipping/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: cart.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, personalisationChoice: line.personalisationChoice, personalisation: line.personalisation })), destination: addressFrom(data) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { showFormIssues(form, result.issues); setDeliveryError(result.error ?? "We couldn't calculate delivery. Check the address and try again."); return; }
      const nextQuotes = Array.isArray(result.quotes) ? result.quotes as ShippingQuote[] : [];
      setQuotes(nextQuotes);
      setSelectedQuoteToken(nextQuotes[0]?.token ?? "");
      if (!nextQuotes.length) setDeliveryError("No delivery service is available for this address. Check the address or contact us.");
    } catch {
      setDeliveryError("We couldn't connect to delivery services. Please try again in a moment.");
    } finally { setQuotePending(false); }
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
      sessionStorage.setItem("commerce-checkout-cart", JSON.stringify({ orderId: result.orderId, lines: cart.lines.map(line => ({ key: line.key, quantity: line.quantity })) }));
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
      <section className="checkout-section"><h2>Contact</h2><div className="field-grid"><label className="field">Full name<input name="name" autoComplete="name" key={addressId} defaultValue={chosenAddress?.recipient ?? account?.name} minLength={2} required /></label><label className="field">Email<input name="email" type="email" autoComplete="email" defaultValue={account?.email} readOnly={Boolean(account)} required /></label></div></section>
      <section className="checkout-section" onChange={event => { if ((event.target as HTMLInputElement).name === "shippingQuote") return; setQuotes([]); setSelectedQuoteToken(""); setDeliveryError(""); }}><h2>Delivery address</h2>{Boolean(account?.addresses?.length)&&<label className="field">Saved address<select value={addressId} onChange={e=>{setAddressId(e.target.value);setQuotes([]);setSelectedQuoteToken("");}}><option value="">New address</option>{account?.addresses?.map(a=><option key={a.id} value={a.id}>{a.label??a.line1}{a.isDefault?" · Default":""}</option>)}</select></label>}<CountryAddressFields key={addressId} initial={chosenAddress} countries={countries} />{account&&<label><input name="saveAddress" type="checkbox"/> Save this delivery address to my account</label>}<button className="button secondary" type="button" disabled={quotePending} onClick={event => calculateDelivery(event.currentTarget.form!)}>{quotePending ? "Calculating…" : "Calculate delivery"}</button>{deliveryError && <p className="form-error" role="alert">{deliveryError}</p>}{quotes.length > 0 && <fieldset className="shipping-options"><legend>Delivery service</legend>{quotes.map(quote => <label key={quote.token}><input type="radio" name="shippingQuote" value={quote.token} checked={selectedQuoteToken === quote.token} onChange={() => setSelectedQuoteToken(quote.token)} /><span><strong>{quote.serviceName}</strong><small>{quote.estimatedDaysMin ? `${quote.estimatedDaysMin}${quote.estimatedDaysMax && quote.estimatedDaysMax !== quote.estimatedDaysMin ? `–${quote.estimatedDaysMax}` : ""} business days` : "Delivery estimate shown after dispatch"}</small></span><b>{quote.amountCents ? money.format(quote.amountCents / 100) : "Free"}</b></label>)}</fieldset>}</section>
      <section className="checkout-section"><h2>Discount code</h2><label className="field">Code<input name="promotionCode" maxLength={32} autoComplete="off" placeholder="Optional" /></label><p className="fine-print">Eligible automatic offers and codes are applied at secure checkout. The final discounted total appears in Stripe before payment.</p></section>
      <section className="checkout-section payment-note"><LockKeyhole /><div><h2>Secure payment</h2><p>You will enter card details on Stripe Checkout. {store.displayName} never stores your card number.</p></div></section>
    </div>
    <aside className="order-summary checkout-summary"><h2>Your order</h2>{cart.lines.map(line => <p key={line.key}><span>{line.productName} × {line.quantity}</span><strong>{money.format(line.unitPriceCents * line.quantity / 100)}</strong></p>)}<p><span>Shipping</span><strong>{selectedQuote ? (shipping ? money.format(shipping / 100) : "Free") : "Calculate at address"}</strong></p><p className="summary-total"><span>Total</span><strong>{money.format((subtotal + shipping) / 100)}</strong></p>{error && <div className="form-error" role="alert">{error}</div>}<button className="button purchase-button" disabled={pending || !selectedQuote}>{pending ? "Preparing secure payment…" : "Continue to secure payment"}</button><p className="fine-print">By continuing, you agree to our <Link href="/terms"><u>terms</u></Link> and acknowledge our <Link href="/privacy"><u>privacy policy</u></Link>.</p></aside>
  </form>;
}
