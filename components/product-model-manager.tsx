"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductModelManager({ productId, variants }: { productId: string; variants: { id: string; name: string; sku: string; modelStorageKey: string | null }[] }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function upload(variantId: string, file: File) {
    setBusy(variantId); setError("");
    const form = new FormData(); form.append("file", file);
    const response = await fetch(`/api/admin/products/${productId}/variants/${variantId}/model`, { method: "POST", body: form });
    const body = await response.json().catch(() => ({})); setBusy("");
    if (!response.ok) return setError(body.error ?? "Model upload failed");
    router.refresh();
  }
  async function remove(variantId: string) {
    setBusy(variantId); setError("");
    const response = await fetch(`/api/admin/products/${productId}/variants/${variantId}/model`, { method: "DELETE" });
    setBusy(""); if (!response.ok) return setError("Model removal failed");
    router.refresh();
  }
  return <section className="admin-panel"><h2>3D views of real products</h2><p>Optional GLB for each normal product variant. Export a self-contained model of the actual item; each colour or size can have its own view. The viewer loads only after the customer opens it.</p><div className="admin-stack">{variants.map(variant => <div className="tag-row" key={variant.id}><div><strong>{variant.name}</strong><small>{variant.sku} · {variant.modelStorageKey ? "3D model ready" : "No 3D view"}</small></div><label className="button secondary">{busy === variant.id ? "Uploading…" : "Upload GLB"}<input type="file" accept=".glb,model/gltf-binary" disabled={Boolean(busy)} hidden onChange={event => { const file = event.target.files?.[0]; if (file) void upload(variant.id, file); }} /></label>{variant.modelStorageKey && <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => void remove(variant.id)}>Remove</button>}</div>)}</div>{error && <p className="form-error" role="alert">{error}</p>}</section>;
}
