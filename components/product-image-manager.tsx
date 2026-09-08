"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Star, Trash2, Upload } from "lucide-react";

type ProductImage = { id: string; url: string; altText: string; sortOrder: number; isPrimary: boolean; byteSize: number };

export function ProductImageManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const form = new FormData(event.currentTarget); form.set("isPrimary", String(images.length === 0));
    const response = await fetch(`/api/admin/products/${productId}/images`, { method: "POST", body: form }); const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Image could not be uploaded");
    event.currentTarget.reset(); router.refresh();
  }
  async function update(image: ProductImage, changes: Partial<ProductImage>, refresh = true) {
    setMessage(""); const response = await fetch(`/api/admin/products/${productId}/images/${image.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ altText: image.altText, sortOrder: image.sortOrder, isPrimary: image.isPrimary, ...changes }) }); const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error ?? "Image could not be updated"); return false; } if (refresh) router.refresh(); return true;
  }
  async function reorder(index: number, direction: -1 | 1) { const target = images[index + direction]; if (!target) return; const current = images[index]; const changed = await Promise.all([update(current, { sortOrder: target.sortOrder }, false), update(target, { sortOrder: current.sortOrder }, false)]); if (changed.every(Boolean)) router.refresh(); }
  async function remove(image: ProductImage) {
    if (!window.confirm("Delete this product image?")) return; const response = await fetch(`/api/admin/products/${productId}/images/${image.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage("Image could not be deleted"); router.refresh();
  }
  return <section className="admin-panel"><div className="panel-heading"><div><h2>Product images</h2><p>PNG, JPEG or WebP · maximum 5 MB · up to 10 images.</p></div></div>{images.length > 0 && <div className="admin-image-grid">{images.map((image, index) => <article key={image.id}><Image src={image.url} alt={image.altText} width={320} height={320} unoptimized /><input defaultValue={image.altText} aria-label="Alternative text" onBlur={event => event.target.value !== image.altText && update(image, { altText: event.target.value })} /><div><button type="button" className={`text-button ${image.isPrimary ? "selected" : ""}`} onClick={() => update(image, { isPrimary: true })}><Star size={15} /> {image.isPrimary ? "Primary" : "Make primary"}</button><span className="image-order"><button type="button" className="icon-button neutral" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label="Move image earlier"><ChevronUp size={16} /></button><button type="button" className="icon-button neutral" disabled={index === images.length - 1} onClick={() => reorder(index, 1)} aria-label="Move image later"><ChevronDown size={16} /></button><button type="button" className="icon-button" onClick={() => remove(image)} aria-label="Delete image"><Trash2 size={16} /></button></span></div></article>)}</div>}<form className="image-upload" onSubmit={upload}><label className="field">Image<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required /></label><label className="field">Alternative text<input name="altText" minLength={3} maxLength={160} placeholder="Describe the product for screen readers" required /></label><button className="button secondary" disabled={pending || images.length >= 10}><Upload size={16} /> {pending ? "Uploading…" : "Upload image"}</button></form>{message && <div className="form-error">{message}</div>}</section>;
}
