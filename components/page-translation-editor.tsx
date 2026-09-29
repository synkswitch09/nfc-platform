"use client";

import { FormEvent, useState } from "react";
import type { LandingSectionDraft } from "@/lib/landing-sections";
import { LandingSectionEditor } from "@/components/landing-section-editor";

export function PageTranslationEditor({ pageId, locale, localeName, missing, metadata, sections, mediaUploadEndpoint }: { pageId: string; locale: string; localeName: string; missing: boolean; metadata: { name: string; seoTitle: string; seoDescription: string }; sections: LandingSectionDraft[]; mediaUploadEndpoint: string }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/pages/${pageId}/translations/${encodeURIComponent(locale)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), seoTitle: form.get("seoTitle"), seoDescription: form.get("seoDescription") }) });
    const result = await response.json().catch(() => ({})); setPending(false); setMessage(response.ok ? "Translation metadata saved" : result.error ?? "Translation could not be saved");
  }
  return <details className="admin-panel locale-editor"><summary><strong>{localeName}</strong><code>{locale}</code><span className={missing ? "translation-missing" : "translation-complete"}>{missing ? "Missing · default shown" : "Translated"}</span></summary><form className="admin-form embedded-form" onSubmit={save}><div className="field-grid"><label className="field">Localized page name<input name="name" defaultValue={metadata.name} /></label><label className="field">Localized SEO title<input name="seoTitle" defaultValue={metadata.seoTitle} maxLength={70} /></label><label className="field wide">Localized meta description<textarea name="seoDescription" defaultValue={metadata.seoDescription} maxLength={170} /></label></div><button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save localized metadata"}</button>{message && <span className={message === "Translation metadata saved" ? "upload-success" : "upload-error"} role="status">{message}</span>}</form><LandingSectionEditor initial={sections} endpoint={`/api/admin/pages/${pageId}/translations/${encodeURIComponent(locale)}/sections`} mediaUploadEndpoint={mediaUploadEndpoint} structureLocked /></details>;
}
