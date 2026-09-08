"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function InventoryAdjuster({ variantId, current, reserved }: { variantId: string; current: number; reserved: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantId, quantity: Number(form.get("quantity")), reason: form.get("reason") }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Stock could not be updated");
    setOpen(false); router.refresh();
  }
  if (!open) return <button className="text-button" type="button" onClick={() => setOpen(true)}>Adjust</button>;
  return <form className="inventory-adjust" onSubmit={submit}><input name="quantity" type="number" min={reserved} defaultValue={current} aria-label="New stock quantity" required /><input name="reason" placeholder="Reason" minLength={3} required /><button className="button">Save</button><button className="text-button" type="button" onClick={() => setOpen(false)}>Cancel</button>{message && <small className="form-error">{message}</small>}</form>;
}
