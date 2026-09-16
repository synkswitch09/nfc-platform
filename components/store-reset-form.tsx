"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";

type StoreResetPreview = {
  categories: number;
  products: number;
  variants: number;
  carts: number;
  orders: number;
  tags: number;
  batches: number;
  manufacturingJobs: number;
  shipments: number;
  printJobs: number;
  inventoryMovements: number;
  auditLogs: number;
};

export function StoreResetForm({
  storeName,
  currency,
  preview,
}: {
  storeName: string;
  currency: string;
  preview: StoreResetPreview;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = Number(form.get("price"));
    if (!Number.isFinite(price) || price < 0)
      return setMessage("Enter a valid product price.");
    if (
      !window.confirm(
        "This permanently clears this store's test commerce, NFC and operational history. Continue?",
      )
    )
      return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/admin/store-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        confirmation: form.get("confirmation"),
        productName: form.get("productName"),
        productSlug: form.get("productSlug"),
        productSku: form.get("productSku"),
        productDescription: form.get("productDescription"),
        priceCents: Math.round(price * 100),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok)
      return setMessage(result.error ?? "The store could not be reset.");
    setMessage("Store reset. Pets and one out-of-stock product are ready.");
    router.replace(`/admin/products/${result.product.id}`);
    router.refresh();
  }

  const rows = [
    ["Categories", preview.categories],
    ["Products / variants", `${preview.products} / ${preview.variants}`],
    ["Carts / orders", `${preview.carts} / ${preview.orders}`],
    ["NFC tags / batches", `${preview.tags} / ${preview.batches}`],
    ["Production jobs", preview.manufacturingJobs],
    ["Shipments / print jobs", `${preview.shipments} / ${preview.printJobs}`],
    ["Inventory movements", preview.inventoryMovements],
    ["Audit entries", preview.auditLogs],
  ];
  return (
    <form className="admin-form" onSubmit={submit}>
      <section className="admin-panel danger-panel">
        <div className="panel-heading">
          <div>
            <h2><AlertTriangle size={20} /> Start fresh</h2>
            <p>
              Clears this store&apos;s catalog and operational test history, then
              creates Pets and one active product with tracked stock set to 0.
            </p>
          </div>
        </div>
        <div className="reset-preview" aria-label="Data to clear">
          {rows.map(([label, value]) => (
            <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
        <p className="muted">
          Kept: store identity, staff access, CMS pages, media not attached to
          catalog categories/products, shipping configuration and print agents.
          A single new audit record is kept to record the reset.
        </p>
      </section>
      <section className="admin-panel">
        <div className="panel-heading"><div><h2>New Pets product</h2><p>Set the initial details now. You can add colours, shapes, sizes and personalisation afterward.</p></div></div>
        <div className="field-grid">
          <label className="field">Product name<input name="productName" defaultValue="Tapkin Pet Tag" required /></label>
          <label className="field">Product URL slug<input name="productSlug" defaultValue="tapkin-pet-tag" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
          <label className="field">Initial SKU<input name="productSku" defaultValue="PET-TAG-001" pattern="[A-Za-z0-9._-]{3,50}" required /></label>
          <label className="field">Initial price ({currency})<input name="price" type="number" min="0" step="0.01" defaultValue="0" required /></label>
          <label className="field wide">Product description<textarea name="productDescription" defaultValue="A personalised NFC pet tag ready to configure for your first launch." minLength={10} maxLength={500} required /></label>
        </div>
      </section>
      <section className="admin-panel">
        <label className="field">
          To confirm, type <strong>{storeName}</strong>
          <input name="confirmation" autoComplete="off" required />
        </label>
      </section>
      {message && <div className={message.startsWith("Store reset") ? "notice" : "form-error"} role="status">{message}</div>}
      <div className="admin-form-actions"><button className="button danger" disabled={pending}><RotateCcw size={16} /> {pending ? "Resetting…" : "Permanently clear test history"}</button></div>
    </form>
  );
}
