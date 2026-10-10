"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LoyaltyConfig } from "@/lib/loyalty-config";
export function LoyaltySettingsForm({ config }: { config: LoyaltyConfig }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const data = new FormData(event.currentTarget);
    const payload = { enabled: data.get("enabled") === "on", allowCouponStacking: data.get("allowCouponStacking") === "on", ...Object.fromEntries(["pointsPerDollar", "redemptionUnitPoints", "redemptionUnitCents", "minimumRedeemPoints", "maximumRedeemPercent", "expiryMonths"].map(k => [k, Number(data.get(k))])) };
    try { const response = await fetch("/api/admin/settings/loyalty", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); setMessage(response.ok ? "Points rules saved for this store" : result.error); if (response.ok) router.refresh(); }
    catch { setMessage("Could not save points rules. Try again"); } finally { setPending(false); }
  }
  return <form className="admin-panel form" onSubmit={submit}><h2>Customer points</h2><p>Store-specific AUD rewards. Existing orders keep the rules recorded when checkout began. Pausing stops new earning and redemption; existing balances, expiry and refund adjustments remain.</p>
    <label className="check-field"><input name="enabled" type="checkbox" defaultChecked={config.enabled} />Enable points for new purchases and redemption</label>
    <div className="field-grid">
      <label className="field">Points per A$1 of products<input name="pointsPerDollar" type="number" min={1} max={10} defaultValue={config.pointsPerDollar} required /></label>
      <label className="field">Points per redemption unit<input name="redemptionUnitPoints" type="number" min={1} max={10000} defaultValue={config.redemptionUnitPoints} required /></label>
      <label className="field">Discount cents per unit<input name="redemptionUnitCents" type="number" min={1} max={10000} defaultValue={config.redemptionUnitCents} required /></label>
      <label className="field">Minimum points to redeem<input name="minimumRedeemPoints" type="number" min={1} max={100000} defaultValue={config.minimumRedeemPoints} required /></label>
      <label className="field">Maximum discount (% of products)<input name="maximumRedeemPercent" type="number" min={1} max={50} defaultValue={config.maximumRedeemPercent} required /></label>
      <label className="field">Expiry (months after credit)<input name="expiryMonths" type="number" min={1} max={36} defaultValue={config.expiryMonths} required /></label>
    </div><label className="check-field"><input name="allowCouponStacking" type="checkbox" defaultChecked={config.allowCouponStacking} />Allow points with promotional discounts</label>
    <p className="fine-print">Points are credited after confirmed payment on products after discounts, excluding shipping. Guests claim their balance by verifying the purchase email. Refunds reverse earned points proportionally and return redeemed points with their original expiry. Points already used from a refunded purchase offset future credits. Points have no cash withdrawal value.</p>
    <button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save points rules"}</button><Link href="/admin/settings/loyalty">View points accounts & adjustments</Link>{message && <p role="status">{message}</p>}</form>;
}
export function LoyaltyAdjustmentForm({ wallets }: { wallets: { id: string; label: string }[] }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const key = useRef(""); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const data = new FormData(event.currentTarget); if (!key.current) key.current = crypto.randomUUID();
    try { const response = await fetch("/api/admin/settings/loyalty", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ walletId: data.get("walletId"), points: Number(data.get("points")), reason: data.get("reason"), key: key.current }) }); const result = await response.json(); setMessage(response.ok ? "Adjustment recorded and audited" : result.error); if (response.ok) router.refresh(); }
    catch { setMessage("Connection failed. Retry without changing the form to avoid a duplicate adjustment"); } finally { setPending(false); }
  }
  return <form className="admin-panel form" onSubmit={submit} onChange={() => { key.current = ""; }}><h2>Audited adjustment</h2><p>Settings-write permission is required. Negative adjustments cannot remove reserved points or exceed the available balance. Positive adjustments retain this store’s current expiry and offset any refund adjustment first.</p><label className="field">Points account<select name="walletId" required>{wallets.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select></label><label className="field">Points to add or remove<input name="points" type="number" min={-100000} max={100000} required /></label><label className="field">Customer-visible reason<textarea name="reason" minLength={10} maxLength={300} required /></label><button className="button secondary" disabled={pending || !wallets.length}>{pending ? "Recording…" : "Record adjustment"}</button>{message && <p role="status">{message}</p>}</form>;
}
