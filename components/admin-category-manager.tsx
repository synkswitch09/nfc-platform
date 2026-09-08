"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

type Category = { id: string; name: string; slug: string; description: string | null; sortOrder: number; active: boolean; seoTitle: string | null; seoDescription: string | null; _count: { products: number } };

export function AdminCategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), slug: form.get("slug"), description: form.get("description") || null, sortOrder: Number(form.get("sortOrder")), active: form.get("active") === "on", seoTitle: form.get("seoTitle") || null, seoDescription: form.get("seoDescription") || null };
    const response = await fetch(editing ? `/api/admin/categories/${editing.id}` : "/api/admin/categories", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Category could not be saved");
    setEditing(null); setMessage("Category saved"); router.refresh(); event.currentTarget.reset();
  }
  async function archive(category: Category) {
    if (!window.confirm(`Archive ${category.name}? Existing products will keep the category.`)) return;
    const response = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage("Category could not be archived");
    router.refresh();
  }
  return <div className="admin-split"><section className="admin-panel"><div className="panel-heading"><div><h2>Categories</h2><p>Order and organise the storefront collection.</p></div></div><div className="category-list">{categories.map(category => <article key={category.id}><div><strong>{category.name}</strong><span>/{category.slug} · {category._count.products} products</span></div><span className={`admin-status ${category.active ? "ACTIVE" : "ARCHIVED"}`}>{category.active ? "ACTIVE" : "ARCHIVED"}</span><button type="button" className="icon-button neutral" onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`}><Pencil size={16} /></button><button type="button" className="icon-button" onClick={() => archive(category)} aria-label={`Archive ${category.name}`}><Trash2 size={16} /></button></article>)}</div></section>
    <form className="admin-panel admin-form compact" onSubmit={save} key={editing?.id ?? "new"}><div className="panel-heading"><div><h2>{editing ? "Edit category" : "New category"}</h2><p>SEO fields are optional.</p></div>{editing && <button type="button" className="text-button" onClick={() => setEditing(null)}><Plus size={15} /> New</button>}</div><label className="field">Name<input name="name" defaultValue={editing?.name} required /></label><label className="field">Slug<input name="slug" defaultValue={editing?.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label className="field">Description<textarea name="description" defaultValue={editing?.description ?? ""} /></label><label className="field">Sort order<input name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? categories.length} required /></label><label className="field">SEO title<input name="seoTitle" defaultValue={editing?.seoTitle ?? ""} maxLength={70} /></label><label className="field">Meta description<textarea name="seoDescription" defaultValue={editing?.seoDescription ?? ""} maxLength={170} /></label><label className="check-field"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /><span>Visible in the storefront</span></label>{message && <p className={message === "Category saved" ? "notice" : "form-error"}>{message}</p>}<button className="button">Save category</button></form></div>;
}
