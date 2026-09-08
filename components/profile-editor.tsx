"use client";

import { FormEvent, useState } from "react";

type ProfileData = { id: string; type: "PET" | "CHILD" | "EMERGENCY" | "SOCIAL" | "BUSINESS" | "LUGGAGE" | "REVIEW" | "CUSTOM"; displayName: string; details: Record<string, unknown>; contacts: Array<{ name: string; relationship?: string | null; phone: string }> };

const fields: Record<ProfileData["type"], Array<[string, string]>> = {
  PET: [["species","Species"],["breed","Breed"],["approximateAge","Approximate age"],["description","Description"],["medicalInfo","Important medical information"],["allergies","Allergies"],["medications","Medications"],["behaviourNotes","Behavioural notes"],["veterinarian","Veterinarian"]],
  CHILD: [["approximateAge","Approximate age"],["criticalMedicalInfo","Critical medical information"],["allergies","Allergies"],["communicationNotes","Communication instructions"]],
  EMERGENCY: [["criticalMedicalInfo","Critical medical information"],["allergies","Allergies"],["communicationNotes","Emergency instructions"]],
  SOCIAL: [["bio","Short bio"],["redirectUrl","Direct redirect URL"]],
  BUSINESS: [["company","Company"],["jobTitle","Job title"],["phone","Phone"],["email","Email"],["website","Website"],["linkedIn","LinkedIn URL"],["bio","Profile summary"]],
  LUGGAGE: [["message","Recovery message"],["contactName","Contact name"],["contactPhone","Contact phone"],["contactEmail","Contact email"]],
  REVIEW: [["redirectUrl","Review page URL"]],
  CUSTOM: [["bio","Profile description"],["redirectUrl","Optional direct URL"]],
};

export function ProfileEditor({ profile }: { profile: ProfileData }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const details: Record<string, unknown> = Object.fromEntries(fields[profile.type].map(([key]) => [key, values[key] || null]));
    if (["CHILD", "EMERGENCY"].includes(profile.type)) details.status = values.status || "NORMAL";
    if (["SOCIAL", "REVIEW", "CUSTOM"].includes(profile.type)) { details.mode = profile.type === "REVIEW" ? "DIRECT_REDIRECT" : values.mode || "MULTI_LINK"; details.links = profile.details.links ?? {}; }
    const contacts = values.contactName && values.contactPhone ? [{ name: values.contactName as string, relationship: values.contactRelationship as string, phone: values.contactPhone as string }] : [];
    const response = await fetch(`/api/tags/${profile.id}/profile`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: profile.type, displayName: values.displayName, details, contacts }) });
    const result = await response.json().catch(() => ({})); setPending(false); setMessage(response.ok ? "Profile saved" : result.error ?? "Could not save");
  }
  return <form className="form card" onSubmit={submit}>
    <h3>Public profile</h3><label className="field">Display name<input name="displayName" defaultValue={profile.displayName} required /></label>
    {profile.type === "CHILD" && <label className="field">Status<select name="status" defaultValue={String(profile.details.status ?? "NORMAL")}><option>NORMAL</option><option>MISSING</option></select></label>}
    {["SOCIAL", "CUSTOM"].includes(profile.type) && <label className="field">Mode<select name="mode" defaultValue={String(profile.details.mode ?? "MULTI_LINK")}><option value="MULTI_LINK">Multi-link profile</option><option value="DIRECT_REDIRECT">Direct redirect</option></select></label>}
    {fields[profile.type].map(([key, label]) => <label className="field" key={key}>{label}{/description|medical|allergies|medications|behaviour|bio|message|communication/i.test(key) ? <textarea name={key} defaultValue={String(profile.details[key] ?? "")} /> : <input name={key} defaultValue={String(profile.details[key] ?? "")} />}</label>)}
    {["PET", "CHILD", "EMERGENCY"].includes(profile.type) && <><h3>Primary emergency contact</h3><label className="field">Name<input name="contactName" defaultValue={profile.contacts[0]?.name ?? ""} /></label><label className="field">Relationship<input name="contactRelationship" defaultValue={profile.contacts[0]?.relationship ?? ""} /></label><label className="field">Phone<input name="contactPhone" inputMode="tel" defaultValue={profile.contacts[0]?.phone ?? ""} /></label></>}
    {message && <div className={message === "Profile saved" ? "notice" : "form-error"} role="status">{message}</div>}<button className="button" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
