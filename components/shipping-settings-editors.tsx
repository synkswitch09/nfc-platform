"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Origin = { id: string; name: string; senderName: string; company: string | null; line1: string; line2: string | null; suburb: string; state: string; postcode: string; country: string; phone: string | null; email: string | null; active: boolean; isDefault: boolean };
type Package = { id: string; name: string; code: string; lengthMm: number; widthMm: number; heightMm: number; emptyWeightGrams: number; maxWeightGrams: number | null; active: boolean };
type Rate = { id: string; serviceName: string; amountCents: number; freeOverCents: number | null; estimatedDaysMin: number | null; estimatedDaysMax: number | null; active: boolean };

function useSave() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: object) {
    setPending(true); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not save changes");
      setMessage(method === "DELETE" ? "Removed" : "Saved"); router.refresh(); return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save changes"); return false; }
    finally { setPending(false); }
  }
  return { pending, message, send };
}

function Status({ message }: { message: string }) { return message && <span role="status" className={message === "Saved" || message === "Removed" ? "upload-success" : "upload-error"}>{message}</span>; }
const nullable = (value: FormDataEntryValue | null) => String(value ?? "").trim() || null;
const nullableNumber = (value: FormDataEntryValue | null) => nullable(value) === null ? null : Number(value);

export function OriginEditor({ origin }: { origin: Origin }) {
  const { pending, message, send } = useSave();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await send(`/api/admin/shipping/origins/${origin.id}`, "PATCH", {
      name: form.get("name"), senderName: form.get("senderName"), company: nullable(form.get("company")),
      line1: form.get("line1"), line2: nullable(form.get("line2")), suburb: form.get("suburb"),
      state: form.get("state"), postcode: form.get("postcode"), country: form.get("country"),
      phone: nullable(form.get("phone")), email: nullable(form.get("email")),
      active: form.get("active") === "on", isDefault: form.get("isDefault") === "on",
    });
  }
  return <form className="shipping-settings-form" onSubmit={save}><div className="field-grid two">
    <label className="field">Origin name<input name="name" defaultValue={origin.name} required /></label>
    <label className="field">Sender name<input name="senderName" defaultValue={origin.senderName} required /></label>
    <label className="field">Company<input name="company" defaultValue={origin.company ?? ""} /></label>
    <label className="field">Address<input name="line1" defaultValue={origin.line1} required /></label>
    <label className="field">Address line 2<input name="line2" defaultValue={origin.line2 ?? ""} /></label>
    <label className="field">Suburb<input name="suburb" defaultValue={origin.suburb} required /></label>
    <label className="field">State<input name="state" defaultValue={origin.state} required /></label>
    <label className="field">Postcode<input name="postcode" defaultValue={origin.postcode} required /></label>
    <label className="field">Country code<input name="country" defaultValue={origin.country} required maxLength={2} /></label>
    <label className="field">Phone<input name="phone" defaultValue={origin.phone ?? ""} /></label>
    <label className="field">Email<input name="email" type="email" defaultValue={origin.email ?? ""} /></label>
  </div><div className="row-actions"><label className="check-field"><input name="active" type="checkbox" defaultChecked={origin.active} />Active</label><label className="check-field"><input name="isDefault" type="checkbox" defaultChecked={origin.isDefault} />Default origin</label><button className="button secondary" disabled={pending}>Save origin</button><Status message={message} /></div></form>;
}

export function PackagingEditor({ item }: { item?: Package }) {
  const { pending, message, send } = useSave();
  const [type, setType] = useState<"BOX" | "MAILER">(item?.code.startsWith("MAILER-") ? "MAILER" : "BOX");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const target = event.currentTarget; const form = new FormData(target);
    const values = { name: form.get("name"), lengthMm: Number(form.get("lengthMm")), widthMm: Number(form.get("widthMm")), heightMm: type === "MAILER" ? 0 : Number(form.get("heightMm")), emptyWeightGrams: Number(form.get("emptyWeightGrams")), maxWeightGrams: nullableNumber(form.get("maxWeightGrams")), active: form.get("active") === "on" };
    const saved = await send(item ? `/api/admin/shipping/packaging/${item.id}` : "/api/admin/shipping/packaging", item ? "PATCH" : "POST", item ? values : { ...values, type });
    if (saved && !item) target.reset();
  }
  async function remove() {
    if (!item || !window.confirm(`Delete ${item.name}? Products using this package must be changed first.`)) return;
    await send(`/api/admin/shipping/packaging/${item.id}`, "DELETE");
  }
  return <form className="shipping-settings-form" onSubmit={save}><div className="field-grid two">
    {!item && <label className="field">Package type<select value={type} onChange={event => setType(event.target.value as "BOX" | "MAILER")}><option value="BOX">Individual box</option><option value="MAILER">Shipping bag</option></select></label>}
    <label className="field">Name<input name="name" defaultValue={item?.name ?? ""} required /></label>
    <label className="field">Length (mm)<input name="lengthMm" type="number" min="1" max="1000" defaultValue={item?.lengthMm ?? ""} required /></label>
    <label className="field">Width (mm)<input name="widthMm" type="number" min="1" max="1000" defaultValue={item?.widthMm ?? ""} required /></label>
    {type === "BOX" && <label className="field">Height (mm)<input name="heightMm" type="number" min="1" max="1000" defaultValue={item?.heightMm || ""} required /></label>}
    <label className="field">Empty package weight (g)<input name="emptyWeightGrams" type="number" min="0" max="30000" defaultValue={item?.emptyWeightGrams ?? 0} required /></label>
    <label className="field">Maximum packed weight (g)<input name="maxWeightGrams" type="number" min="1" max="30000" defaultValue={item?.maxWeightGrams ?? ""} /></label>
  </div><div className="row-actions"><label className="check-field"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} />Available for products</label><button className="button secondary" disabled={pending}>{item ? "Save package" : "Add package"}</button>{item && <button className="button secondary" type="button" disabled={pending} onClick={remove}>Delete</button>}<Status message={message} /></div></form>;
}

export function RateEditor({ rate }: { rate: Rate }) {
  const { pending, message, send } = useSave();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await send(`/api/admin/shipping/rates/${rate.id}`, "PATCH", { serviceName: form.get("serviceName"), amountCents: Math.round(Number(form.get("amount")) * 100), freeOverCents: nullable(form.get("freeOver")) === null ? null : Math.round(Number(form.get("freeOver")) * 100), estimatedDaysMin: nullableNumber(form.get("minDays")), estimatedDaysMax: nullableNumber(form.get("maxDays")), active: form.get("active") === "on" });
  }
  return <form className="shipping-settings-form" onSubmit={save}><div className="field-grid two">
    <label className="field">Service name<input name="serviceName" defaultValue={rate.serviceName} required /></label>
    <label className="field">Delivery charge (AUD)<input name="amount" type="number" min="0" step="0.01" defaultValue={(rate.amountCents / 100).toFixed(2)} required /></label>
    <label className="field">Free over (AUD, optional)<input name="freeOver" type="number" min="0" step="0.01" defaultValue={rate.freeOverCents === null ? "" : (rate.freeOverCents / 100).toFixed(2)} /></label>
    <label className="field">Minimum delivery days<input name="minDays" type="number" min="0" defaultValue={rate.estimatedDaysMin ?? ""} /></label>
    <label className="field">Maximum delivery days<input name="maxDays" type="number" min="0" defaultValue={rate.estimatedDaysMax ?? ""} /></label>
  </div><div className="row-actions"><label className="check-field"><input name="active" type="checkbox" defaultChecked={rate.active} />Rate enabled</label><button className="button secondary" disabled={pending}>Save rate</button><Status message={message} /></div></form>;
}
