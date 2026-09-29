"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { StoreCapability } from "@prisma/client";

const capabilityOptions = [
  { value: StoreCapability.COMMERCE, label: "Online shop" },
  { value: StoreCapability.PRINT_3D, label: "3D printing" },
  { value: StoreCapability.INVENTORY, label: "Inventory" },
  { value: StoreCapability.NFC, label: "NFC products" },
  { value: StoreCapability.DIGITAL_PROFILE, label: "Digital profiles" },
  { value: StoreCapability.PET_PROFILE, label: "Pet profiles" },
  { value: StoreCapability.CUSTOM_PERSONALISATION, label: "Personalisation" },
] as const;
const defaultCapabilities: StoreCapability[] = [StoreCapability.COMMERCE, StoreCapability.PRINT_3D, StoreCapability.INVENTORY];

export function CreateStoreForm({ environment }: { environment: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), slug: data.get("slug"), hostname: data.get("hostname"),
          supportEmail: data.get("supportEmail"), capabilities: data.getAll("capabilities"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create the store");
      setSuccess(`${data.get("name")} was created as a draft. Configure its content before going live.`);
      form.reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the store");
    } finally {
      setPending(false);
    }
  }

  return <section className="admin-panel">
    <h2>Create store</h2>
    <p className="muted">The new store starts as a draft in {environment}. Set up DNS and HTTPS in Azure separately.</p>
    <form onSubmit={submit} className="create-store-form">
      <label>Store name<input name="name" type="text" required minLength={2} maxLength={100} placeholder="Kosykin" /></label>
      <label>Slug<input name="slug" type="text" required pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" maxLength={50} placeholder="kosykin" /></label>
      <label>Domain for {environment}<input name="hostname" type="text" required placeholder="staging.kosykin.com.au" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <label>Support email<input name="supportEmail" type="email" required placeholder="hello@kosykin.com.au" /></label>
      <fieldset><legend>Features</legend>
        {capabilityOptions.map(({ value, label }) => <label key={value} className="create-store-feature"><input name="capabilities" type="checkbox" value={value} defaultChecked={defaultCapabilities.includes(value)} />{label}</label>)}
      </fieldset>
      {error && <p role="alert" className="form-error">{error}</p>}
      {success && <p role="status">{success}</p>}
      <button type="submit" className="button" disabled={pending}>{pending ? "Creating…" : "Create draft store"}</button>
    </form>
  </section>;
}
