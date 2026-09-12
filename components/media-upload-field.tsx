"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { isSafeImageSource } from "@/lib/image-source";

export function MediaUploadField({ uploadEndpoint, disabledMessage, label, name, value, onChange }: { uploadEndpoint?: string; disabledMessage: string; label: string; name?: string; value: string; onChange: (value: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!uploadEndpoint) return setMessage(disabledMessage);
    if (!file) return setMessage("Choose a PNG, JPEG or WebP image first.");
    setPending(true); setMessage("");
    const form = new FormData(); form.set("file", file);
    const response = await fetch(uploadEndpoint, { method: "POST", body: form });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Image could not be uploaded");
    onChange(result.image.url);
    if (fileRef.current) fileRef.current.value = "";
    setMessage("Image uploaded. Save to publish this selection.");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.[0] && !uploadEndpoint) setMessage(disabledMessage); else setMessage("");
  }

  return <div className="category-image-field">
    <label className="field">{label}<input name={name} type="text" inputMode="url" value={value} placeholder="Upload below or paste an HTTPS image URL" onChange={event => onChange(event.target.value)} /></label>
    {value && isSafeImageSource(value) && <Image src={value} alt="Selected preview" width={180} height={120} unoptimized />}
    <div className="category-image-upload"><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={!uploadEndpoint || pending} onChange={chooseFile} aria-label={`Choose ${label.toLowerCase()}`} /><button className="button secondary" type="button" disabled={!uploadEndpoint || pending} onClick={upload}><Upload size={16} /> {pending ? "Uploading…" : "Upload image"}</button></div>
    <span className="field-hint">PNG, JPEG or WebP, maximum 5 MB.{!uploadEndpoint ? ` ${disabledMessage}` : " Or select an existing approved media URL."}</span>
    {message && <span className={message.startsWith("Image uploaded") ? "upload-success" : "upload-error"} role="status">{message}</span>}
  </div>;
}
