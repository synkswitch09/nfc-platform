"use client";

import { FormEvent, useState } from "react";

type ProfileData = { id: string; type: "PET" | "CHILD" | "EMERGENCY" | "SOCIAL" | "BUSINESS" | "LUGGAGE" | "REVIEW" | "CUSTOM"; displayName: string; details: Record<string, unknown>; contacts: Array<{ name: string; relationship?: string | null; phone: string }> };

const fields: Record<ProfileData["type"], Array<[string, string]>> = {
  PET: [["species","Species"],["breed","Breed"],["approximateAge","Approximate age"],["description","Description"],["medicalInfo","Important medical information"],["allergies","Allergies"],["medications","Medications"],["behaviourNotes","Behavioural notes"],["veterinarian","Veterinarian"]],
  CHILD: [["approximateAge","Approximate age (public, optional)"],["criticalMedicalInfo","Critical medical information"],["allergies","Allergies"],["communicationNotes","Communication instructions"]],
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
    if (["SOCIAL", "REVIEW", "CUSTOM"].includes(profile.type)) {
      details.mode = profile.type === "REVIEW" ? "DIRECT_REDIRECT" : values.mode || "MULTI_LINK";
      details.links = Object.fromEntries(socialLinks.flatMap(([key, label]) => values[`link-${key}`] ? [[label, values[`link-${key}`]]] : []));
    }
    const contacts = [0, 1].flatMap(index => values[`contactName-${index}`] && values[`contactPhone-${index}`] ? [{ name: values[`contactName-${index}`] as string, relationship: values[`contactRelationship-${index}`] as string, phone: values[`contactPhone-${index}`] as string }] : []);
    const response = await fetch(`/api/tags/${profile.id}/profile`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: profile.type, displayName: values.displayName, details, contacts }) });
    const result = await response.json().catch(() => ({})); setPending(false); setMessage(response.ok ? "Profile saved" : result.error ?? "Could not save");
  }
  return <form className="form card" onSubmit={submit}>
    <h3>Public profile</h3>
    {profile.type === "CHILD" && <div className="notice" id="child-privacy-help"><strong>Privacy-first setup</strong><br />Everything entered below can appear after a scan. Use a first name or neutral alias and only essential safety information. Do not add a surname, home address, school, routine or other identifying details.</div>}
    <label className="field">{profile.type === "CHILD" ? "Public alias or first name" : "Display name"}<input name="displayName" defaultValue={profile.displayName} aria-describedby={profile.type === "CHILD" ? "child-privacy-help" : undefined} autoComplete={profile.type === "CHILD" ? "off" : undefined} required /></label>
    {profile.type === "CHILD" && <label className="field">Status<select name="status" defaultValue={String(profile.details.status ?? "NORMAL")}><option>NORMAL</option><option>MISSING</option></select></label>}
    {["SOCIAL", "CUSTOM"].includes(profile.type) && <label className="field">Mode<select name="mode" defaultValue={String(profile.details.mode ?? "MULTI_LINK")}><option value="MULTI_LINK">Multi-link profile</option><option value="DIRECT_REDIRECT">Direct redirect</option></select></label>}
    {fields[profile.type].map(([key, label]) => <label className="field" key={key}>{label}{/description|medical|allergies|medications|behaviour|bio|message|communication/i.test(key) ? <textarea name={key} defaultValue={String(profile.details[key] ?? "")} /> : <input name={key} defaultValue={String(profile.details[key] ?? "")} />}</label>)}
    {["SOCIAL", "CUSTOM"].includes(profile.type) && <><h3>Profile links</h3>{socialLinks.map(([key, label]) => <label className="field" key={key}>{label}<input name={`link-${key}`} type="url" defaultValue={profileLink(profile.details.links, label)} placeholder="https://" /></label>)}</>}
    {["PET", "CHILD", "EMERGENCY"].includes(profile.type) && [0, 1].map(index => <fieldset className="contact-fields" key={index}><legend>{index ? "Secondary emergency contact" : "Primary emergency contact"}</legend><label className="field">Name<input name={`contactName-${index}`} defaultValue={profile.contacts[index]?.name ?? ""} /></label><label className="field">Relationship<input name={`contactRelationship-${index}`} defaultValue={profile.contacts[index]?.relationship ?? ""} /></label><label className="field">Phone<input name={`contactPhone-${index}`} inputMode="tel" defaultValue={profile.contacts[index]?.phone ?? ""} /></label></fieldset>)}
    {message && <div className={message === "Profile saved" ? "notice" : "form-error"} role="status">{message}</div>}<button className="button" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}

const socialLinks = [["instagram", "Instagram"], ["tiktok", "TikTok"], ["facebook", "Facebook"], ["linkedin", "LinkedIn"], ["youtube", "YouTube"], ["whatsapp", "WhatsApp"], ["website", "Website"], ["custom", "Custom link"]] as const;
function profileLink(value: unknown, label: string) { return value && typeof value === "object" ? String((value as Record<string, unknown>)[label] ?? "") : ""; }
