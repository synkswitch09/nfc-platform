"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CountryAddressFields, type CountryAddressValue } from "@/components/country-address-fields";

type Address = CountryAddressValue & { id: string; label: string | null; recipient: string; locality: string; postcode: string; country: string };

export function AddressManager({ addresses, defaultName, countries }: { addresses: Address[]; defaultName: string; countries: string[] }) {
  const router = useRouter(); const [editing, setEditing] = useState<Address | null>(null); const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); const form = new FormData(event.currentTarget); const optional = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    const payload = { label: optional("label"), recipient: form.get("recipient"), company: optional("company"), line1: form.get("line1"), line2: optional("line2"), dependentLocality: optional("dependentLocality"), locality: form.get("locality"), administrativeArea: optional("administrativeArea"), postcode: form.get("postcode"), country: form.get("country"), phone: optional("phone") };
    const response = await fetch(editing ? `/api/account/addresses/${editing.id}` : "/api/account/addresses", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Address could not be saved"); setEditing(null); setMessage("Address saved"); router.refresh(); event.currentTarget.reset();
  }
  async function remove(address: Address) { if (!window.confirm(`Delete ${address.label ?? "this address"}?`)) return; const response = await fetch(`/api/account/addresses/${address.id}`, { method: "DELETE" }); if (!response.ok) return setMessage("Address could not be deleted"); router.refresh(); }
  return <div className="account-grid"><section><div className="address-grid">{addresses.map(address => <article className="card" key={address.id}><div><strong>{address.label ?? "Delivery address"}</strong><div className="address-actions"><button className="icon-button neutral" onClick={() => setEditing(address)} aria-label="Edit address"><Pencil size={16} /></button><button className="icon-button" onClick={() => remove(address)} aria-label="Delete address"><Trash2 size={16} /></button></div></div><address>{address.recipient}<br />{address.company && <>{address.company}<br /></>}{address.line1}<br />{address.line2 && <>{address.line2}<br /></>}{address.dependentLocality && <>{address.dependentLocality}<br /></>}{address.locality}{address.administrativeArea ? `, ${address.administrativeArea}` : ""} {address.postcode}<br />{address.country}</address></article>)}</div>{!addresses.length && <div className="card"><h3>No saved addresses</h3><p className="muted">Save one to make your next checkout faster.</p></div>}</section><form className="card form" onSubmit={save} key={editing?.id ?? "new"}><div className="panel-heading"><div><h2>{editing ? "Edit address" : "Add address"}</h2></div>{editing && <button className="text-button" type="button" onClick={() => setEditing(null)}><Plus size={15} /> New</button>}</div><label className="field">Label<input name="label" defaultValue={editing?.label ?? ""} placeholder="Home, Work…" /></label><label className="field">Recipient<input name="recipient" defaultValue={editing?.recipient ?? defaultName} required /></label><CountryAddressFields initial={editing} countries={countries} />{message && <div className={message === "Address saved" ? "notice" : "form-error"}>{message}</div>}<button className="button">Save address</button></form></div>;
}
