"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  status: string;
  storeName: string;
  businessName: string | null;
  supportEmail: string | null;
  currency: string;
  defaultCountry: string;
  timezone: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  siteTitle: string;
  siteDescription: string;
  defaultSocialImageUrl: string | null;
  socialLinks: Record<string, string | null>;
  shippingConfig: Record<string, number>;
  theme: { accent: string; accentSecondary: string; background: string; foreground: string; radius: string; fontStyle: string };
  homepage: { heroEyebrow: string; heroHeadline: string; heroDescription: string; primaryCtaLabel: string; primaryCtaHref: string };
  capabilities: string[];
};

type Domain = { id: string; environment: string; hostname: string; protocol: string; isPrimary: boolean };

export function StoreSettingsForm({ settings, domains, platformAdmin, availableCapabilities }: { settings: Settings; domains: Domain[]; platformAdmin: boolean; availableCapabilities: string[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    const payload = {
      storeName: form.get("storeName"), businessName: form.get("businessName"), supportEmail: form.get("supportEmail"), currency: String(form.get("currency")).toUpperCase(), defaultCountry: String(form.get("defaultCountry")).toUpperCase(), timezone: form.get("timezone"),
      logoUrl: form.get("logoUrl"), faviconUrl: form.get("faviconUrl"), siteTitle: form.get("siteTitle"), siteDescription: form.get("siteDescription"), defaultSocialImageUrl: form.get("defaultSocialImageUrl"),
      instagram: form.get("instagram"), facebook: form.get("facebook"), tiktok: form.get("tiktok"), linkedin: form.get("linkedin"), flatRateCents: Math.round(Number(form.get("flatRate")) * 100), freeOverCents: Math.round(Number(form.get("freeOver")) * 100),
      theme: { accent: form.get("accent"), accentSecondary: form.get("accentSecondary"), background: form.get("background"), foreground: form.get("foreground"), radius: form.get("radius"), fontStyle: form.get("fontStyle") },
      homepage: { heroEyebrow: form.get("heroEyebrow"), heroHeadline: form.get("heroHeadline"), heroDescription: form.get("heroDescription"), primaryCtaLabel: form.get("primaryCtaLabel"), primaryCtaHref: form.get("primaryCtaHref") },
      ...(platformAdmin ? { status: form.get("status"), capabilities: form.getAll("capabilities") } : {}),
    };
    const response = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Settings could not be saved");
    setMessage("Settings saved");
    router.refresh();
  }
  return <form className="admin-form" onSubmit={submit}>
    <section className="admin-panel"><div className="panel-heading"><div><h2>General</h2><p>Public identity, market and support contact for this Store.</p></div></div><div className="field-grid"><label className="field">Store name<input name="storeName" defaultValue={settings.storeName} required /></label><label className="field">Legal business name<input name="businessName" defaultValue={settings.businessName ?? ""} /></label><label className="field">Support email<input name="supportEmail" type="email" defaultValue={settings.supportEmail ?? ""} required /></label><label className="field">Timezone<input name="timezone" defaultValue={settings.timezone} required /></label><label className="field">Country code<input name="defaultCountry" defaultValue={settings.defaultCountry} minLength={2} maxLength={2} required /></label><label className="field">Currency<input name="currency" defaultValue={settings.currency} minLength={3} maxLength={3} required /></label>{platformAdmin && <label className="field">Store lifecycle<select name="status" defaultValue={settings.status}><option>DRAFT</option><option>ACTIVE</option><option>HIDDEN</option><option>ARCHIVED</option></select></label>}</div></section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Branding and theme</h2><p>Shared components consume these Store-specific design tokens.</p></div></div><div className="field-grid"><label className="field">Logo URL<input name="logoUrl" type="url" defaultValue={settings.logoUrl ?? ""} placeholder="https://…" /></label><label className="field">Favicon URL<input name="faviconUrl" type="url" defaultValue={settings.faviconUrl ?? ""} placeholder="https://…" /></label><label className="field">Accent<input name="accent" type="color" defaultValue={settings.theme.accent} /></label><label className="field">Secondary accent<input name="accentSecondary" type="color" defaultValue={settings.theme.accentSecondary} /></label><label className="field">Background<input name="background" type="color" defaultValue={settings.theme.background} /></label><label className="field">Foreground<input name="foreground" type="color" defaultValue={settings.theme.foreground} /></label><label className="field">Corner radius<input name="radius" defaultValue={settings.theme.radius} pattern="[0-9.]+(px|rem)" /></label><label className="field">Typography style<select name="fontStyle" defaultValue={settings.theme.fontStyle}><option value="editorial">Editorial</option><option value="modern">Modern</option><option value="technical">Technical</option></select></label></div></section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Homepage hero</h2><p>Structured content keeps each brand distinctive without a generic page builder.</p></div></div><div className="field-grid"><label className="field">Eyebrow<input name="heroEyebrow" defaultValue={settings.homepage.heroEyebrow} maxLength={100} required /></label><label className="field">Primary CTA label<input name="primaryCtaLabel" defaultValue={settings.homepage.primaryCtaLabel} maxLength={50} required /></label><label className="field wide">Headline<input name="heroHeadline" defaultValue={settings.homepage.heroHeadline} maxLength={180} required /></label><label className="field wide">Description<textarea name="heroDescription" defaultValue={settings.homepage.heroDescription} maxLength={360} required /></label><label className="field">CTA path<input name="primaryCtaHref" defaultValue={settings.homepage.primaryCtaHref} pattern="/(?!/).*" required /></label></div></section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Search defaults</h2><p>Store-specific metadata used when a page has no override.</p></div></div><label className="field">Site title<input name="siteTitle" defaultValue={settings.siteTitle} maxLength={70} required /></label><label className="field">Site description<textarea name="siteDescription" defaultValue={settings.siteDescription} maxLength={170} required /></label><label className="field">Default social image URL<input name="defaultSocialImageUrl" type="url" defaultValue={settings.defaultSocialImageUrl ?? ""} /></label></section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Shipping and social</h2><p>Store-level checkout defaults and public channels.</p></div></div><div className="field-grid"><label className="field">Flat shipping {settings.currency}<input name="flatRate" inputMode="decimal" defaultValue={((settings.shippingConfig.flatRateCents ?? 900) / 100).toFixed(2)} required /></label><label className="field">Free shipping over {settings.currency}<input name="freeOver" inputMode="decimal" defaultValue={((settings.shippingConfig.freeOverCents ?? 6000) / 100).toFixed(2)} required /></label><label className="field">Instagram URL<input name="instagram" type="url" defaultValue={settings.socialLinks.instagram ?? ""} /></label><label className="field">Facebook URL<input name="facebook" type="url" defaultValue={settings.socialLinks.facebook ?? ""} /></label><label className="field">TikTok URL<input name="tiktok" type="url" defaultValue={settings.socialLinks.tiktok ?? ""} /></label><label className="field">LinkedIn URL<input name="linkedin" type="url" defaultValue={settings.socialLinks.linkedin ?? ""} /></label></div></section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Domains</h2><p>Trusted host allowlist by deployment environment. Changes require platform-level domain verification.</p></div></div><div className="domain-list">{domains.map(domain => <div key={domain.id}><span className="admin-status">{domain.environment}</span><code>{domain.protocol}://{domain.hostname}</code>{domain.isPrimary && <strong>Primary</strong>}</div>)}</div></section>
    {platformAdmin && <section className="admin-panel"><div className="panel-heading"><div><h2>Capabilities</h2><p>Modules exposed by this Store. Issued NFC identities prevent unsafe NFC removal.</p></div></div><div className="capability-grid">{availableCapabilities.map(capability => <label className="check-field" key={capability}><input type="checkbox" name="capabilities" value={capability} defaultChecked={settings.capabilities.includes(capability)} />{capability.replaceAll("_", " ")}</label>)}</div></section>}
    {message && <div className={message === "Settings saved" ? "notice" : "form-error"}>{message}</div>}<div className="admin-form-actions"><button className="button">Save settings</button></div>
  </form>;
}
