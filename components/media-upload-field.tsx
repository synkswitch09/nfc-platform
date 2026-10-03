"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Images, Upload, X } from "lucide-react";
import { isSafeImageSource } from "@/lib/image-source";

type LibraryItem = { id: string; url: string; label: string };

export function MediaUploadField({ uploadEndpoint = "/api/admin/settings/images", label, name, value, onChange }: { uploadEndpoint?: string; disabledMessage?: string; label: string; name?: string; value: string; onChange: (value: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  async function loadLibrary(search = "") {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/media?q=${encodeURIComponent(search)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load media");
      setItems(result.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load media");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMessage("Choose a PNG, JPEG or WebP image first.");
    setPending(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(uploadEndpoint, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Image could not be uploaded");
      onChange(result.image.url);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Image uploaded. Save to publish this selection.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image could not be uploaded");
    } finally { setPending(false); }
  }

  return <div className="category-image-field">
    <label className="field">{label}<input name={name} type="text" inputMode="url" value={value} placeholder="Choose from library, upload, or paste an HTTPS URL" onChange={event => onChange(event.target.value)} /></label>
    {value && isSafeImageSource(value) && <Image src={value} alt="Selected preview" width={180} height={120} unoptimized />}
    <div className="category-image-upload">
      <button className="button secondary" type="button" onClick={() => { setOpen(true); setQuery(""); void loadLibrary(); }}><Images size={16} /> Choose from library</button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={() => setMessage("")} aria-label={`Choose ${label.toLowerCase()}`} />
      <button className="button secondary" type="button" disabled={pending} onClick={upload}><Upload size={16} /> {pending ? "Uploading…" : "Upload image"}</button>
    </div>
    <span className="field-hint">PNG, JPEG or WebP, maximum 5 MB.</span>
    {message && <span className={message.startsWith("Image uploaded") ? "upload-success" : "upload-error"} role="status">{message}</span>}
    {open && <div className="media-picker-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="media-picker" role="dialog" aria-modal="true" aria-label={`Choose ${label.toLowerCase()} from media library`}>
        <div className="media-picker-heading"><h3>Choose an image</h3><button type="button" className="icon-button" aria-label="Close media library" onClick={() => setOpen(false)}><X size={19} /></button></div>
        <div className="media-picker-search"><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void loadLibrary(query); } }} placeholder="Search by product, page or description" aria-label="Search media" /><button type="button" onClick={() => void loadLibrary(query)} className="button secondary" disabled={loading}>Search</button></div>
        {loading ? <p role="status">Loading images…</p> : items.length ? <div className="media-picker-grid">{items.map(item => <button type="button" key={item.id} className={item.url === value ? "selected" : ""} onClick={() => { onChange(item.url); setOpen(false); setMessage(""); }}><Image src={item.url} alt="" width={160} height={120} unoptimized /><span>{item.label}</span></button>)}</div> : <p>{query ? "No images match this search." : "No images uploaded yet."}</p>}
        <small>Showing up to 100 recent results. Search to find older images.</small>
      </div>
    </div>}
  </div>;
}
