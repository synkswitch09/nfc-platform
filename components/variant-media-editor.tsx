"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Upload } from "lucide-react";

export type VariantMedia = {
  images: { id: string; url: string; altText: string; sortOrder: number; isPrimary: boolean; optionValueId: string | null; variantId: string | null }[];
  videos: { id: string; url: string; caption: string }[];
  modelStorageKey: string | null;
};

export function VariantMediaEditor({ productId, variantId, media, generated3d = false }: { productId?: string; variantId?: string; media?: VariantMedia; generated3d?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoCaption, setVideoCaption] = useState("");
  const [uploadSequence, setUploadSequence] = useState(0);
  const base = `/api/admin/products/${productId}/variants/${variantId}`;
  const images = media?.images ?? [];
  const videos = media?.videos ?? [];

  async function upload(kind: "image" | "video") {
    if (!productId || !variantId) return;
    const file = kind === "image" ? imageFile : videoFile;
    if (!file) { setError("Select a file first."); return; }
    setBusy(kind); setError("");
    const form = new FormData(); form.set("file", file);
    if (kind === "image") { form.set("altText", imageAlt); form.set("variantId", variantId); }
    if (kind === "video") form.set("caption", videoCaption);
    const url = kind === "image" ? `/api/admin/products/${productId}/images` : `${base}/videos`;
    try {
      const response = await fetch(url, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error ?? "Upload failed"); return; }
      if (kind === "image") { setImageFile(null); setImageAlt(""); }
      if (kind === "video") { setVideoFile(null); setVideoCaption(""); }
      setUploadSequence(current => current + 1);
      router.refresh();
    } catch { setError("Upload failed. Please try again."); }
    finally { setBusy(""); }
  }

  async function uploadModel(file: File) {
    setBusy("model"); setError("");
    const form = new FormData(); form.set("file", file);
    try {
      const response = await fetch(`${base}/model`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error ?? "GLB upload failed"); return; }
      setUploadSequence(current => current + 1);
      router.refresh();
    } catch { setError("GLB upload failed. Please try again."); }
    finally { setBusy(""); }
  }

  async function remove(kind: "image" | "video" | "model", id?: string) {
    if (!productId || !variantId || !window.confirm(`Remove this ${kind}?`)) return;
    setBusy(id ?? kind); setError("");
    const url = kind === "image" ? `/api/admin/products/${productId}/images/${id}` : kind === "video" ? `${base}/videos/${id}` : `${base}/model`;
    try {
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error ?? "Could not remove media"); return; }
      router.refresh();
    } catch { setError("Could not remove media. Please try again."); }
    finally { setBusy(""); }
  }

  async function updateImage(image: VariantMedia["images"][number], changes: Partial<VariantMedia["images"][number]>, refresh = true) {
    if (!productId) return false;
    const response = await fetch(`/api/admin/products/${productId}/images/${image.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ altText: image.altText, isPrimary: image.isPrimary, sortOrder: image.sortOrder, optionValueId: image.optionValueId, variantId: image.variantId, ...changes }) });
    if (!response.ok) { setError("Could not update the photo"); return false; }
    if (refresh) router.refresh();
    return true;
  }

  async function moveImage(index: number, direction: -1 | 1) {
    const a = images[index], b = images[index + direction]; if (!b) return;
    setBusy("reorder");
    const first = await updateImage(a, { sortOrder: b.sortOrder }, false);
    const second = first && await updateImage(b, { sortOrder: a.sortOrder }, false);
    setBusy(""); if (second) router.refresh();
  }

  return <div className="variant-media" onClick={event => event.stopPropagation()}>
    <h3>Photos, video and 3D</h3>
    {!productId || !variantId ? <p className="muted">Save the product first. Then upload media here for this variant.</p> : <>
      <div className="variant-media-grid">
        <div className="variant-media-group">
          <strong>Photos ({images.length})</strong>
          <div className="variant-media-photos">{images.map((image, index) => <div key={image.id} className="variant-media-photo"><Image src={image.url} alt={image.altText} width={180} height={180} unoptimized /><input aria-label="Photo description" defaultValue={image.altText} onBlur={event => { if (event.target.value !== image.altText) void updateImage(image, { altText: event.target.value }); }} /><div><button type="button" className="icon-button neutral" aria-label="Move photo earlier" disabled={Boolean(busy) || index === 0} onClick={() => void moveImage(index, -1)}><ChevronUp size={16} /></button><button type="button" className="icon-button neutral" aria-label="Move photo later" disabled={Boolean(busy) || index === images.length - 1} onClick={() => void moveImage(index, 1)}><ChevronDown size={16} /></button><button type="button" className="icon-button" aria-label="Remove photo" disabled={Boolean(busy)} onClick={() => void remove("image", image.id)}><Trash2 size={16} /></button></div></div>)}</div>
          <label className="field">Add photo (PNG, JPG or WebP, up to 5 MB)<input key={`image-${uploadSequence}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setImageFile(event.target.files?.[0] ?? null)} /></label>
          <label className="field">Photo description<input value={imageAlt} minLength={3} maxLength={160} onChange={event => setImageAlt(event.target.value)} placeholder="Describe this variant" /></label>
          <button type="button" className="button secondary" disabled={Boolean(busy) || !imageFile || imageAlt.trim().length < 3} onClick={() => void upload("image")}><Upload size={16} /> {busy === "image" ? "Uploading…" : "Add photo"}</button>
        </div>
        <div className="variant-media-group">
          <strong>Video ({videos.length})</strong>
          {videos.map(video => <div className="variant-video-row" key={video.id}><video controls preload="none" src={video.url} aria-label={video.caption} /><span>{video.caption}</span><button type="button" className="icon-button" aria-label="Remove video" disabled={Boolean(busy)} onClick={() => void remove("video", video.id)}><Trash2 size={16} /></button></div>)}
          <label className="field">Add MP4 video (up to 50 MB)<input key={`video-${uploadSequence}`} type="file" accept="video/mp4,.mp4" onChange={event => setVideoFile(event.target.files?.[0] ?? null)} /></label>
          <label className="field">Video description<input value={videoCaption} minLength={3} maxLength={160} onChange={event => setVideoCaption(event.target.value)} placeholder="Show this variant in use" /></label>
          <button type="button" className="button secondary" disabled={Boolean(busy) || videos.length >= 5 || !videoFile || videoCaption.trim().length < 3} onClick={() => void upload("video")}><Upload size={16} /> {busy === "video" ? "Uploading…" : "Add video"}</button>
        </div>
        <div className="variant-media-group">
          <strong>3D view</strong>
          {generated3d ? <p className="muted">The personalised 3D preview is generated automatically from the customer’s choices.</p> : <>
            <p className="muted">Upload one GLB model of this actual variant. Export its colours and textures inside the file.</p>
            {media?.modelStorageKey && <div className="variant-model-actions"><a href={`/api/media/${media.modelStorageKey}`} target="_blank" rel="noreferrer">Download current GLB</a><button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => void remove("model")}>Remove GLB</button></div>}
            <label className="field">{media?.modelStorageKey ? "Replace GLB" : "Add GLB"} (up to 20 MB)<input key={`model-${uploadSequence}`} type="file" accept=".glb,model/gltf-binary" disabled={Boolean(busy)} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadModel(file); }} /></label>
          </>}
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>}
  </div>;
}
