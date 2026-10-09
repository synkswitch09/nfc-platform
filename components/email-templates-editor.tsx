"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, ImagePlus, Plus, Trash2 } from "lucide-react";
import { MediaUploadField } from "@/components/media-upload-field";
import { defaultEmailTemplate, emailTemplateKeys, emailTemplateLabels, getEmailTemplateEntry, templateTokens, validateEmailTemplate, type EmailBlock, type EmailTemplate, type EmailTemplateKey, type EmailTemplates } from "@/lib/email-templates";

type Preview = { subject: string; html: string; text: string };
export function EmailTemplatesEditor({ initial, canEdit, canPublish, testRecipient }: { initial: EmailTemplates; canEdit: boolean; canPublish: boolean; testRecipient: string }) {
  const [templates, setTemplates] = useState(initial);
  const [key, setKey] = useState<EmailTemplateKey>("verification");
  const [template, setTemplate] = useState<EmailTemplate>(getEmailTemplateEntry(initial, "verification").draft);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [showText, setShowText] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const entry = getEmailTemplateEntry(templates, key);
  const dirty = JSON.stringify(template) !== JSON.stringify(entry.draft);
  const unpublished = !entry.published || JSON.stringify(template) !== JSON.stringify(entry.published);
  const valid = validateEmailTemplate(key, template);

  useEffect(() => {
    const controller = new AbortController();
    setPreview(null); setPreviewError("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/email-templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, action: "preview", template }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Preview is unavailable");
        if (!controller.signal.aborted) setPreview(data);
      } catch (error) { if (!controller.signal.aborted) setPreviewError(error instanceof Error ? error.message : "Preview is unavailable"); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, template]);

  function selectTemplate(next: EmailTemplateKey) {
    if (dirty && !window.confirm("Discard unsaved changes to this draft?")) return;
    setKey(next); setTemplate(getEmailTemplateEntry(templates, next).draft); setMessage("");
  }
  function updateBlock(index: number, block: EmailBlock) { setTemplate(current => ({ ...current, blocks: current.blocks.map((item, i) => i === index ? block : item) })); }
  function move(index: number, direction: number) {
    setTemplate(current => { const blocks = [...current.blocks]; [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]]; return { ...current, blocks }; });
  }
  function add(type: EmailBlock["type"]) {
    const block: EmailBlock = type === "divider" ? { type } : type === "image" ? { type, url: "", alt: "" } : type === "button" ? { type, text: "Visit our store", url: "{{store.url}}" } : { type, text: type === "heading" ? "Your heading" : "Your text. Use {{customer.name}} to personalise it." };
    setTemplate(current => ({ ...current, blocks: [...current.blocks, block] }));
  }
  async function action(actionName: "save" | "publish" | "reset" | "test") {
    if (actionName === "reset" && !window.confirm("Restore the standard template for live emails and discard this draft?")) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/email-templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, action: actionName, template, revision: entry.revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The template could not be saved");
      if (data.entry) { setTemplates(current => ({ ...current, [key]: data.entry })); setTemplate(data.entry.draft); }
      setMessage(data.message ?? (actionName === "publish" ? "Published. New emails from this store now use this template." : actionName === "reset" ? "Standard template restored for this store." : "Draft saved. Live emails have not changed."));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { setPending(false); }
  }
  function exportTemplate() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "store-email-template", version: 1, key, template }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${key}-email-template.json`; link.click(); URL.revokeObjectURL(url);
  }
  async function importTemplate(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("Template files must be smaller than 100 KB.");
      const data = JSON.parse(await file.text());
      if (data.format !== "store-email-template" || data.version !== 1 || data.key !== key) throw new Error("Choose an exported JSON file for this notification type.");
      const parsed = validateEmailTemplate(key, data.template);
      if (!parsed.success) throw new Error(parsed.error);
      setTemplate(parsed.data); setMessage("Template imported into this draft. Review the preview before publishing. Uploaded images belong to their original environment; upload them here if needed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invalid template file"); }
    if (importRef.current) importRef.current.value = "";
  }
  return <div className="email-workspace">
    <section className="admin-panel email-selector"><label className="field">Notification type<select value={key} disabled={pending} onChange={event => selectTemplate(event.target.value as EmailTemplateKey)}>{emailTemplateKeys.map(item => <option key={item} value={item}>{emailTemplateLabels[item]}</option>)}</select></label>
      <p className="field-hint">{entry.published ? `Custom template published ${new Date(entry.publishedAt!).toLocaleDateString("en-AU")}.` : "The standard template is active."} {dirty ? "Unsaved draft changes." : unpublished ? "Draft ready for review." : "Draft matches the live template."}</p>
      <div className="email-actions">{canEdit && <button className="button secondary" disabled={pending || !valid.success} onClick={() => void action("save")}>Save draft</button>}{canPublish && <button className="button" disabled={pending || !valid.success} onClick={() => void action("publish")}>Publish template</button>}</div>
      {message && <p role="status" className="email-status">{message}</p>}
    </section>
    <div className="email-editor-grid"><section className="admin-panel email-composer"><h2>Compose email</h2>
      <fieldset disabled={!canEdit || pending} className="email-fields"><label className="field">Subject<input value={template.subject} maxLength={250} onChange={event => setTemplate({ ...template, subject: event.target.value })} /></label>
        <label className="field">Inbox preview text<input value={template.preheader} maxLength={250} onChange={event => setTemplate({ ...template, preheader: event.target.value })} /></label>
        <label className="field">Accent colour<input type="color" value={template.accent} onChange={event => setTemplate({ ...template, accent: event.target.value })} /></label>
        <div className="email-token-list"><p>Dynamic fields — copy and paste into text:</p>{templateTokens(key).map(token => <button key={token} type="button" className="email-token" onClick={() => { void navigator.clipboard.writeText(`{{${token}}}`).then(() => setMessage(`Copied {{${token}}}.`)).catch(() => setMessage(`Select and copy {{${token}}}.`)); }}><Copy size={12} /><code>{`{{${token}}}`}</code></button>)}</div>
        {template.blocks.map((block, index) => <div className="email-block" key={index}><div className="email-block-heading"><strong>{index + 1}. {block.type}</strong><div><button type="button" className="icon-button" aria-label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" className="icon-button" aria-label={`Move block ${index + 1} down`} disabled={index === template.blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button type="button" className="icon-button" aria-label={`Remove block ${index + 1}`} onClick={() => setTemplate({ ...template, blocks: template.blocks.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></div></div>
          {(block.type === "text" || block.type === "heading") && <label className="field">{block.type === "heading" ? "Heading" : "Text"}<textarea rows={block.type === "heading" ? 2 : 4} maxLength={3000} value={block.text} onChange={event => updateBlock(index, { ...block, text: event.target.value })} /></label>}
          {block.type === "image" && <><MediaUploadField uploadEndpoint="/api/admin/email-templates/images" label="Email image" value={block.url} onChange={url => updateBlock(index, { ...block, url })} /><label className="field">Image description<input value={block.alt} maxLength={200} onChange={event => updateBlock(index, { ...block, alt: event.target.value })} /></label></>}
          {block.type === "button" && <><label className="field">Button label<input value={block.text} maxLength={120} onChange={event => updateBlock(index, { ...block, text: event.target.value })} /></label><label className="field">Button URL<input value={block.url} onChange={event => updateBlock(index, { ...block, url: event.target.value })} placeholder="https://… or {{store.url}}" /></label></>}
          {block.type === "divider" && <hr />}
        </div>)}
        <div className="email-add-blocks">{(["heading", "text", "image", "button", "divider"] as const).map(type => <button type="button" className="button secondary" key={type} disabled={template.blocks.length >= 24} onClick={() => add(type)}>{type === "image" ? <ImagePlus size={15} /> : <Plus size={15} />} {type}</button>)}</div>
      </fieldset>
      {!valid.success && <p role="alert" className="upload-error">{valid.error}</p>}
      <div className="email-protected"><strong>Required notification details</strong><p>Verification codes, secure links, order updates, reward conditions and support instructions are added automatically after your blocks. These details cannot be removed by editing the template. Emails also include a plain text version.</p></div>
      <div className="email-actions"><button className="button secondary" onClick={exportTemplate}><Download size={15} /> Export JSON</button>{canEdit && <label className="button secondary">Import JSON<input className="email-import" ref={importRef} type="file" accept=".json,application/json" disabled={pending} onChange={event => void importTemplate(event.target.files?.[0])} /></label>}</div>
      {canPublish && <div className="email-actions"><button className="button secondary" disabled={pending} onClick={() => { setTemplate(defaultEmailTemplate(key)); setMessage("Standard design loaded into the draft. Publish to make it live."); }}>Load standard design</button><button className="button secondary" disabled={pending} onClick={() => void action("reset")}>Restore standard live template</button></div>}
    </section><section className="admin-panel email-preview-panel"><div className="email-preview-heading"><h2>Live preview</h2><div className="email-actions"><button className="button secondary" onClick={() => setMobile(!mobile)}>{mobile ? "Desktop preview" : "Mobile preview"}</button><button className="button secondary" onClick={() => setShowText(!showText)}>{showText ? "HTML email" : "Plain text"}</button></div></div>
      <p className="field-hint">Example data only. Preview links do not perform account actions.</p>
      {previewError ? <p role="alert">{previewError}</p> : preview ? <><p className="email-preview-subject"><strong>Subject:</strong> {preview.subject}</p>{showText ? <pre className="email-text-preview">{preview.text}</pre> : <iframe title="Email preview" sandbox="" srcDoc={preview.html} className={`email-preview-frame${mobile ? " email-preview-mobile" : ""}`} />}</> : <p role="status">Updating preview…</p>}
      {canEdit && <div className="email-test"><p>Send this draft with example data to your account email: <strong>{testRecipient}</strong>. Production sends a real test; staging uses the email sandbox.</p><button className="button secondary" disabled={pending || !valid.success} onClick={() => void action("test")}>Send test to my email</button></div>}
    </section></div>
  </div>;
}
