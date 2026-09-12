"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { isSafeImageSource } from "@/lib/image-source";

type Props = {
  categoryId?: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
};

export function CategoryImageUploadField({ categoryId, label, name, value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!categoryId) return setMessage("Save the category first, then upload its images.");
    if (!file) return setMessage("Choose a PNG, JPEG or WebP image first.");
    setPending(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/admin/categories/${categoryId}/images`, { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Image could not be uploaded");
    onChange(result.image.url);
    if (fileRef.current) fileRef.current.value = "";
    setMessage("Image uploaded. Save the page to publish this selection.");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.[0] && !categoryId) setMessage("Save the category first, then upload its images.");
    else setMessage("");
  }

  return <div className="category-image-field">
    <label className="field">{label}<input name={name} type="text" inputMode="url" value={value} placeholder="Upload below or paste an HTTPS image URL" onChange={event => onChange(event.target.value)} /></label>
    {value && isSafeImageSource(value) && <Image src={value} alt="Selected preview" width={180} height={120} unoptimized />}
    <div className="category-image-upload">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={!categoryId || pending} onChange={chooseFile} aria-label={`Choose ${label.toLowerCase()}`} />
      <button className="button secondary" type="button" disabled={!categoryId || pending} onClick={upload}><Upload size={16} /> {pending ? "Uploading…" : "Upload image"}</button>
    </div>
    <span className="field-hint">PNG, JPEG or WebP, maximum 5 MB.{!categoryId ? " Save the category before uploading." : " You can also keep an approved external URL."}</span>
    {message && <span className={message.startsWith("Image uploaded") ? "upload-success" : "upload-error"} role="status">{message}</span>}
  </div>;
}
