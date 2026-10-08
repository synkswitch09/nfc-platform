"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { emailCategories, type EmailCategory, type EmailSenders } from "@/lib/email-senders";
const labels: Record<EmailCategory, string> = { default: "Default", orders: "Orders & delivery", account: "Account & security", promotions: "Promotions", support: "Support tickets" };
const descriptions: Record<EmailCategory, string> = { default: "Used when a message has no specific category.", orders: "Payment confirmations, receipts and shipping updates.", account: "Verification codes, password recovery, security alerts and team invitations.", promotions: "Sender for marketing campaigns. This setting does not start campaigns or subscribe customers.", support: "Notifications about ticket responses. Customers continue the conversation in their account." };
export function EmailSendersForm({ senders, domain }: { senders: EmailSenders; domain: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(emailCategories.map(category => [category, { address: String(form.get(`${category}.address`) ?? "").trim(), name: String(form.get(`${category}.name`) ?? "").trim() }]));
    try {
      const response = await fetch("/api/admin/settings/email", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      setMessage(response.ok ? "Email senders saved" : result.error ?? "Senders could not be saved");
      if (response.ok) router.refresh();
    } catch { setMessage("Senders could not be saved. Please try again."); }
    finally { setPending(false); }
  }
  return <form className="admin-panel form" onSubmit={submit}>
    <h2>Email senders</h2>
    <p>Configure each sender for this store using @{domain}. Leave a category address empty to use the default sender. Provider credentials remain managed securely on the server.</p>
    <p>Customer service is handled through Account → Help & requests. Emails explain that replies are not monitored and link to the ticket channel.</p>
    {emailCategories.map(category => <fieldset className="admin-subpanel" key={category}><legend>{labels[category]}</legend><p>{descriptions[category]}</p><div className="field-grid"><label className="field">Sender email<input type="email" name={`${category}.address`} maxLength={254} defaultValue={senders[category].address} placeholder={`Use default sender`}/></label><label className="field">Display name<input name={`${category}.name`} maxLength={80} defaultValue={senders[category].name}/></label></div></fieldset>)}
    <button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save email senders"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
