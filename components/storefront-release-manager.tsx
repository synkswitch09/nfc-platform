"use client";

import { ChangeEvent, useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";

type Preview = {
  sourceStore: string;
  categories: { create: number; update: number };
  pages: { create: number; update: number };
  products: { create: number; update: number };
  media: { files: number; bytes: number };
  excluded: string[];
};

export function StorefrontReleaseManager() {
  const [release, setRelease] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setMessage("");
    setRelease(null);
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      setMessage("Release files must be 40 MB or smaller.");
      return;
    }
    try {
      setRelease(JSON.parse(await file.text()));
    } catch {
      setMessage("Choose a valid JSON storefront release file.");
    }
  }

  async function requestPreview() {
    if (!release) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/admin/storefront-releases/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(release),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "The release could not be previewed.");
    setPreview(result.preview);
  }

  async function importRelease() {
    if (!release || !preview) return;
    if (!window.confirm("Import this storefront release? It creates or updates catalog and CMS content, but never orders, customers or NFC data.")) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/admin/storefront-releases/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(release),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "The release could not be imported.");
    setMessage("Storefront release imported successfully.");
  }

  return (
    <div className="admin-stack">
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Create release</h2>
            <p>Download the current storefront, catalog, CMS and embedded media as a versioned release file.</p>
          </div>
          <a className="button" href="/api/admin/storefront-releases/export">
            <Download size={16} /> Download release
          </a>
        </div>
      </section>
      <section className="admin-panel">
        <div className="panel-heading"><div><h2>Preview and import</h2><p>Import creates or updates by page/category slug and product SKU. It does not delete content that is absent from the release.</p></div></div>
        <label className="field wide">
          Storefront release file
          <input type="file" accept="application/json,.json" onChange={chooseFile} />
          <small>{fileName || "Choose the JSON file downloaded from Development."}</small>
        </label>
        <div className="admin-form-actions">
          <button type="button" className="button secondary" disabled={!release || pending} onClick={requestPreview}><FileUp size={16} /> {pending ? "Checking…" : "Preview changes"}</button>
          <button type="button" className="button" disabled={!preview || pending} onClick={importRelease}><Upload size={16} /> {pending ? "Importing…" : "Import release"}</button>
        </div>
        {preview && <div className="release-preview notice" role="status"><strong>From {preview.sourceStore}</strong><p>Categories: {preview.categories.create} create, {preview.categories.update} update · Pages: {preview.pages.create} create, {preview.pages.update} update · Products: {preview.products.create} create, {preview.products.update} update.</p><p>Media: {preview.media.files} files ({(preview.media.bytes / 1024 / 1024).toFixed(1)} MB).</p><p>Excluded: {preview.excluded.join(", ")}.</p></div>}
        {message && <p className={message.includes("successfully") ? "notice" : "form-error"} role="status">{message}</p>}
      </section>
    </div>
  );
}
