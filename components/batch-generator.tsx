"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { Download, Printer } from "lucide-react";

type ProductOption = { id: string; name: string; variants: Array<{ id: string; name: string; sku: string }> };
type Credential = { sequence: number; publicTagId: string; activationCode: string; publicUrl: string; qrDataUrl: string };

export function BatchGenerator({ products }: { products: ProductOption[] }) {
  const [rows, setRows] = useState<Credential[]>([]); const [batchNumber, setBatchNumber] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); const data = new FormData(event.currentTarget);
    const selection = String(data.get("selection")).split(":");
    const response = await fetch("/api/admin/tags/batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: selection[0], productVariantId: selection[1] || null, quantity: Number(data.get("quantity")), notes: data.get("notes") }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setError(result.error ?? "Could not create batch");
    setRows(result.credentials); setBatchNumber(result.batch.batchNumber);
  }
  function downloadCsv() {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [["batch", "sequence", "public_tag_id", "activation_code", "public_url"], ...rows.map(row => [batchNumber, row.sequence, row.publicTagId, row.activationCode, row.publicUrl])].map(line => line.map(quote).join(",")).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `${batchNumber}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  if (rows.length) return <section className="batch-sheet"><div className="notice"><strong>{batchNumber} created.</strong> Activation codes cannot be retrieved again. Export this sheet now and store it securely.</div><div className="admin-actions print-hidden"><button className="button" type="button" onClick={downloadCsv}><Download size={16} /> Export CSV</button><button className="button secondary" type="button" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button></div><div className="batch-label-grid">{rows.map(row => <article key={row.publicTagId}><Image src={row.qrDataUrl} alt={`QR ${row.publicTagId}`} width={220} height={220} unoptimized /><strong>{batchNumber} · {String(row.sequence).padStart(3, "0")}</strong><span>{row.publicTagId}</span><code>{row.activationCode}</code></article>)}</div></section>;
  return <form className="admin-panel admin-form batch-form" onSubmit={submit}><div className="panel-heading"><div><h2>Create secure batch</h2><p>Each physical unit receives a random public ID and separate activation secret.</p></div></div><label className="field">Product and variant<select name="selection" required>{products.map(product => product.variants.length ? <optgroup label={product.name} key={product.id}>{product.variants.map(variant => <option value={`${product.id}:${variant.id}`} key={variant.id}>{variant.name} · {variant.sku}</option>)}</optgroup> : <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label className="field">Quantity<input type="number" name="quantity" min="1" max="100" defaultValue="10" required /></label><label className="field">Production notes<textarea name="notes" maxLength={500} placeholder="Material, colour, printer or job notes" /></label>{error && <div className="form-error">{error}</div>}<button className="button" disabled={pending || !products.length}>{pending ? "Generating and hashing…" : "Generate production batch"}</button></form>;
}
