"use client";
import { FormEvent, useState } from "react";
export function OrderSupportForm({ orderId, claimToken,topics }: { orderId: string; claimToken?: string;topics?:string[] }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const [result, setResult] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setResult("");
    const form = new FormData(event.currentTarget);
    let attachments:{name:string;type:string;data:string}[]=[];
    try{const files=form.getAll("photos").filter((f):f is File=>f instanceof File&&f.size>0);if(files.length>3||files.some(f=>f.size>512000||!["image/jpeg","image/png","image/webp"].includes(f.type)))throw new Error("Choose up to 3 JPG, PNG or WebP photos, up to 500 KB each.");attachments=await Promise.all(files.map(async file=>({name:file.name,type:file.type,data:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);})})));
    const response = await fetch(`/api/orders/${orderId}/support`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: form.get("kind"), message, claimToken,attachments }) });
    const body = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setResult(body.error ?? "Could not send your request");
    setMessage(""); setResult("Your request has been sent. You can follow it in Help & requests.");}catch(error){setResult(error instanceof Error?error.message:"Could not send request");}finally{setPending(false);}
  }
  return <section className="card"><h2>Need help with this order?</h2><p>Ask about changes, delivery or quality. A cancellation request will be reviewed by the store.</p><form onSubmit={submit}><label className="field">Topic<select name="kind">{(topics??["ORDER_CHANGE","ADDRESS_CHANGE","CANCELLATION_REQUEST","DELIVERY","QUALITY","OTHER"]).map(topic=><option key={topic} value={topic}>{topic.replaceAll("_"," ")}</option>)}</select></label><label className="field">Message<textarea value={message} minLength={10} maxLength={2000} onChange={event => setMessage(event.target.value)} required /></label><label className="field">Photos (optional)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple/><small>Up to 3 photos, 500 KB each. Visible to you and the support team.</small></label><button className="button secondary" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>{result && <p role="status">{result}</p>}</form></section>;
}
