"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";

type ProductOption = { id: string; name: string; variants: Array<{ id: string; name: string }> };
type Credential = { sequence: number; publicTagId: string; activationCode: string; publicUrl: string; qrDataUrl: string };

export function BatchGenerator({ products }: { products: ProductOption[] }) {
  const [rows, setRows] = useState<Credential[]>([]); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/tags/batch", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({productId:data.get("productId"), quantity:Number(data.get("quantity"))}) });
    const result = await response.json().catch(() => ({})); setPending(false); if (!response.ok) return setError(result.error ?? "Could not create batch"); setRows(result.credentials);
  }
  return <><form className="form card" onSubmit={submit}><label className="field">Product<select name="productId">{products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className="field">Quantity<input type="number" name="quantity" min="1" max="100" defaultValue="10" /></label>{error && <div className="form-error">{error}</div>}<button className="button" disabled={pending}>{pending ? "Generating securely…" : "Generate production batch"}</button></form>{rows.length > 0 && <section><div className="notice">Activation codes are shown only in this result. Print or export this production sheet now and keep it secure.</div><div className="grid" style={{marginTop:18}}>{rows.map(row => <article className="card" key={row.publicTagId}><Image src={row.qrDataUrl} alt={`QR ${row.publicTagId}`} width={220} height={220} unoptimized style={{width:"100%",height:"auto"}} /><strong>Tag {String(row.sequence).padStart(3,"0")}</strong><p>{row.publicTagId}</p><code>{row.activationCode}</code></article>)}</div></section>}</>;
}
