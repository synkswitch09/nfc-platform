"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LockKeyhole, PackageCheck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { CountryAddressFields, type CountryAddressValue } from "@/components/country-address-fields";

type CheckoutAddress = CountryAddressValue & { recipient: string };

type ShippingQuote = { token: string; providerKey: string; serviceCode: string; serviceName: string; amountCents: number; estimatedDaysMin: number | null; estimatedDaysMax: number | null; expiresAt: string };

export function CheckoutForm({ account, store, countries }: { account: { name: string; email: string; address: CheckoutAddress | null } | null; store: { displayName: string; currency: string; nfcEnabled: boolean }; countries: string[] }) {
  const cart = useCart();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const [error, setError] = useState("");
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
    setError(""); setQuotePending(true); setQuotes([]); setSelectedQuoteToken("");
    const data = new FormData(form);
    const response = await fetch("/api/shipping/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: cart.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, personalisationChoice: line.personalisationChoice, personalisation: line.personalisation })), destination: addressFrom(data) }) });
    const result = await response.json().catch(() => ({}));
    setQuotePending(false);
    if (!response.ok) { setError(result.error ?? "Delivery rates are unavailable"); return; }
    const nextQuotes = Array.isArray(result.quotes) ? result.quotes as ShippingQuote[] : [];
    setQuotes(nextQuotes);
    setSelectedQuoteToken(nextQuotes[0]?.token ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!selectedQuoteToken) { setError("Calculate and select a delivery service before payment."); return; }
    setPending(true);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: cart.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, personalisationChoice: line.personalisationChoice, personalisation: line.personalisation })),
        shippingQuoteToken: selectedQuoteToken,
        customer: {
          name: data.get("name"), email: data.get("email"),
          shipping: addressFrom(data),
        },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setPending(false); setError(result.error ?? "Checkout is unavailable"); return; }
    sessionStorage.setItem("commerce-clear-cart-on-success", "true");
    window.location.assign(result.url);
  }

  return <form className="checkout-layout" onSubmit={submit}>
    <div className="checkout-fields">
      {!account && <div className="guest-banner"><strong>Continue as guest</strong><span>No account is required to buy. {store.nfcEnabled ? "Create one after payment to manage connected products." : "You can create one later to manage this order."}</span></div>}
      {account && <div className="guest-banner"><strong>Signed in as {account.name}</strong><span>Your order will appear in your account after payment.</span></div>}
      <section className="checkout-section"><h2>Contact</h2><div className="field-grid"><label className="field">Full name<input name="name" autoComplete="name" defaultValue={account?.address?.recipient ?? account?.name} required /></label><label className="field">Email<input name="email" type="email" autoComplete="email" defaultValue={account?.email} required /></label></div></section>
      <section className="checkout-section" onChange={() => { setQuotes([]); setSelectedQuoteToken(""); }}><h2>Delivery address</h2>{account?.address && <p className="notice">Your first saved address has been filled in. You can edit it for this order.</p>}<CountryAddressFields initial={account?.address} countries={countries} /><button className="button secondary" type="button" disabled={quotePending} onClick={event => calculateDelivery(event.currentTarget.form!)}>{quotePending ? "Calculating…" : "Calculate delivery"}</button>{quotes.length > 0 && <fieldset className="shipping-options"><legend>Delivery service</legend>{quotes.map(quote => <label key={quote.token}><input type="radio" name="shippingQuote" value={quote.token} checked={selectedQuoteToken === quote.token} onChange={() => setSelectedQuoteToken(quote.token)} /><span><strong>{quote.serviceName}</strong><small>{quote.estimatedDaysMin ? `${quote.estimatedDaysMin}${quote.estimatedDaysMax && quote.estimatedDaysMax !== quote.estimatedDaysMin ? `–${quote.estimatedDaysMax}` : ""} business days` : "Delivery estimate shown after dispatch"}</small></span><b>{quote.amountCents ? money.format(quote.amountCents / 100) : "Free"}</b></label>)}</fieldset>}</section>
      <section className="checkout-section payment-note"><LockKeyhole /><div><h2>Secure payment</h2><p>You will enter card details on Stripe Checkout. {store.displayName} never stores your card number.</p></div></section>
    </div>
    <aside className="order-summary checkout-summary"><h2>Your order</h2>{cart.lines.map(line => <p key={line.key}><span>{line.productName} × {line.quantity}</span><strong>{money.format(line.unitPriceCents * line.quantity / 100)}</strong></p>)}<p><span>Shipping</span><strong>{selectedQuote ? (shipping ? money.format(shipping / 100) : "Free") : "Calculate at address"}</strong></p><p className="summary-total"><span>Total</span><strong>{money.format((subtotal + shipping) / 100)}</strong></p>{error && <div className="form-error" role="alert">{error}</div>}<button className="button purchase-button" disabled={pending || !selectedQuote}>{pending ? "Preparing secure payment…" : "Continue to secure payment"}</button><p className="fine-print">By continuing, you agree to our <Link href="/terms"><u>terms</u></Link> and acknowledge our <Link href="/privacy"><u>privacy policy</u></Link>.</p></aside>
  </form>;
}
