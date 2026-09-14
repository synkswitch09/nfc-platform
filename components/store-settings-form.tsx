"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUploadField } from "@/components/media-upload-field";
import type { FooterConfig, HeaderConfig } from "@/lib/site-chrome";
import {
  baseVisualThemeKeys,
  type StorefrontTheme,
} from "@/lib/storefront-theme";
import { fontFamilies, fontWeights, type Typography } from "@/lib/typography";

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
  theme: StorefrontTheme;
  homepage: {
    heroEyebrow: string;
    heroHeadline: string;
    heroDescription: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
  };
  headerConfig: HeaderConfig;
  footerConfig: FooterConfig;
  capabilities: string[];
};

type Domain = {
  id: string;
  environment: string;
  hostname: string;
  protocol: string;
  port: number | null;
  isPrimary: boolean;
};

export function StoreSettingsForm({
  settings,
  domains,
  platformAdmin,
  availableCapabilities,
}: {
  settings: Settings;
  domains: Domain[];
  platformAdmin: boolean;
  availableCapabilities: string[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(settings.faviconUrl ?? "");
  const [socialImageUrl, setSocialImageUrl] = useState(
    settings.defaultSocialImageUrl ?? "",
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    const payload = {
      storeName: form.get("storeName"),
      businessName: form.get("businessName"),
      supportEmail: form.get("supportEmail"),
      currency: String(form.get("currency")).toUpperCase(),
      defaultCountry: String(form.get("defaultCountry")).toUpperCase(),
      timezone: form.get("timezone"),
      logoUrl: form.get("logoUrl"),
      faviconUrl: form.get("faviconUrl"),
      siteTitle: form.get("siteTitle"),
      siteDescription: form.get("siteDescription"),
      defaultSocialImageUrl: form.get("defaultSocialImageUrl"),
      instagram: settings.socialLinks.instagram ?? "",
      facebook: settings.socialLinks.facebook ?? "",
      tiktok: settings.socialLinks.tiktok ?? "",
      linkedin: settings.socialLinks.linkedin ?? "",
      flatRateCents: Math.round(Number(form.get("flatRate")) * 100),
      freeOverCents: Math.round(Number(form.get("freeOver")) * 100),
      theme: {
        accent: form.get("accent"),
        accentSecondary: form.get("accentSecondary"),
        background: form.get("background"),
        foreground: form.get("foreground"),
        radius: form.get("radius"),
        fontStyle: form.get("fontStyle"),
        typography: Object.fromEntries(
          (["body", "heading", "eyebrow", "button", "card"] as const).map((role) => [
            role,
            {
              family: form.get(`type-${role}-family`),
              weight: form.get(`type-${role}-weight`),
              italic: form.get(`type-${role}-italic`) === "on",
              sizePx: Number(form.get(`type-${role}-size`)),
            },
          ]),
        ),
        pageThemes: Object.fromEntries(
          baseVisualThemeKeys.map((key) => [
            key,
            {
              accent: form.get(`theme-${key}-accent`),
              soft: form.get(`theme-${key}-soft`),
              deep: form.get(`theme-${key}-deep`),
              contrast: form.get(`theme-${key}-contrast`),
            },
          ]),
        ),
      },
      homepage: settings.homepage,
      headerConfig: settings.headerConfig,
      footerConfig: settings.footerConfig,
      ...(platformAdmin
        ? {
            status: form.get("status"),
            capabilities: form.getAll("capabilities"),
          }
        : {}),
    };
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      return setMessage(result.error ?? "Settings could not be saved");
    setMessage("Settings saved");
    router.refresh();
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>General</h2>
            <p>Public identity, market and support contact for this Store.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            Store name
            <input
              name="storeName"
              defaultValue={settings.storeName}
              required
            />
          </label>
          <label className="field">
            Legal business name
            <input
              name="businessName"
              defaultValue={settings.businessName ?? ""}
            />
          </label>
          <label className="field">
            Support email
            <input
              name="supportEmail"
              type="email"
              defaultValue={settings.supportEmail ?? ""}
              required
            />
          </label>
          <label className="field">
            Timezone
            <input name="timezone" defaultValue={settings.timezone} required />
          </label>
          <label className="field">
            Country code
            <input
              name="defaultCountry"
              defaultValue={settings.defaultCountry}
              minLength={2}
              maxLength={2}
              required
            />
          </label>
          <label className="field">
            Currency
            <input
              name="currency"
              defaultValue={settings.currency}
              minLength={3}
              maxLength={3}
              required
            />
          </label>
          {platformAdmin && (
            <label className="field">
              Store lifecycle
              <select name="status" defaultValue={settings.status}>
                <option>DRAFT</option>
                <option>ACTIVE</option>
                <option>HIDDEN</option>
                <option>ARCHIVED</option>
              </select>
            </label>
          )}
        </div>
        <ThemePaletteFields theme={settings.theme} />
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Branding and theme</h2>
            <p>
              Shared components consume these Store-specific design tokens and
              the existing media storage.
            </p>
          </div>
        </div>
        <div className="field-grid">
          <MediaUploadField
            uploadEndpoint="/api/admin/settings/images"
            disabledMessage="Store media upload is unavailable."
            label="Default logo"
            name="logoUrl"
            value={logoUrl}
            onChange={setLogoUrl}
          />
          <MediaUploadField
            uploadEndpoint="/api/admin/settings/images"
            disabledMessage="Store media upload is unavailable."
            label="Favicon"
            name="faviconUrl"
            value={faviconUrl}
            onChange={setFaviconUrl}
          />
          <label className="field">
            Accent
            <input
              name="accent"
              type="color"
              defaultValue={settings.theme.accent}
            />
          </label>
          <label className="field">
            Secondary accent
            <input
              name="accentSecondary"
              type="color"
              defaultValue={settings.theme.accentSecondary}
            />
          </label>
          <label className="field">
            Background
            <input
              name="background"
              type="color"
              defaultValue={settings.theme.background}
            />
          </label>
          <label className="field">
            Foreground
            <input
              name="foreground"
              type="color"
              defaultValue={settings.theme.foreground}
            />
          </label>
          <label className="field">
            Corner radius
            <input
              name="radius"
              defaultValue={settings.theme.radius}
              pattern="[0-9.]+(px|rem)"
            />
          </label>
          <label className="field">
            Typography style
            <select name="fontStyle" defaultValue={settings.theme.fontStyle}>
              <option value="editorial">Editorial</option>
              <option value="modern">Modern</option>
              <option value="technical">Technical</option>
            </select>
          </label>
        </div>
        <h3>Storefront typography</h3>
        <p className="field-hint">Inter is the default. These values apply to Home, category and extra pages; individual CMS sections can override them.</p>
        <div className="field-grid">
          <TypographyFields label="Body text" name="body" value={settings.theme.typography.body} />
          <TypographyFields label="Headings" name="heading" value={settings.theme.typography.heading} />
          <TypographyFields label="Eyebrows" name="eyebrow" value={settings.theme.typography.eyebrow} />
          <TypographyFields label="Buttons" name="button" value={settings.theme.typography.button} />
          <TypographyFields label="Cards and FAQs" name="card" value={settings.theme.typography.card} />
        </div>
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Search defaults</h2>
            <p>Store-specific metadata used when a page has no override.</p>
          </div>
        </div>
        <label className="field">
          Site title
          <input
            name="siteTitle"
            defaultValue={settings.siteTitle}
            maxLength={70}
            required
          />
        </label>
        <label className="field">
          Site description
          <textarea
            name="siteDescription"
            defaultValue={settings.siteDescription}
            maxLength={170}
            required
          />
        </label>
        <MediaUploadField
          uploadEndpoint="/api/admin/settings/images"
          disabledMessage="Store media upload is unavailable."
          label="Default social image"
          name="defaultSocialImageUrl"
          value={socialImageUrl}
          onChange={setSocialImageUrl}
        />
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Shipping</h2>
            <p>Store-level checkout defaults.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            Flat shipping {settings.currency}
            <input
              name="flatRate"
              inputMode="decimal"
              defaultValue={(
                (settings.shippingConfig.flatRateCents ?? 900) / 100
              ).toFixed(2)}
              required
            />
          </label>
          <label className="field">
            Free shipping over {settings.currency}
            <input
              name="freeOver"
              inputMode="decimal"
              defaultValue={(
                (settings.shippingConfig.freeOverCents ?? 6000) / 100
              ).toFixed(2)}
              required
            />
          </label>
        </div>
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Domains</h2>
            <p>
              Trusted host allowlist by deployment environment. Changes require
              platform-level domain verification.
            </p>
          </div>
        </div>
        <div className="domain-list">
          {domains.map((domain) => (
            <div key={domain.id}>
              <span className="admin-status">{domain.environment}</span>
              <code>
                {domain.protocol}://{domain.hostname}
                {domain.port ? `:${domain.port}` : ""}
              </code>
              {domain.isPrimary && <strong>Primary</strong>}
            </div>
          ))}
        </div>
      </section>
      {platformAdmin && (
        <section className="admin-panel">
          <div className="panel-heading">
            <div>
              <h2>Capabilities</h2>
              <p>
                Modules exposed by this Store. Issued NFC identities prevent
                unsafe NFC removal.
              </p>
            </div>
          </div>
          <div className="capability-grid">
            {availableCapabilities.map((capability) => (
              <label className="check-field" key={capability}>
                <input
                  type="checkbox"
                  name="capabilities"
                  value={capability}
                  defaultChecked={settings.capabilities.includes(capability)}
                />
                {capability.replaceAll("_", " ")}
              </label>
            ))}
          </div>
        </section>
      )}
      {message && (
        <div className={message === "Settings saved" ? "notice" : "form-error"}>
          {message}
        </div>
      )}
      <div className="admin-form-actions">
        <button className="button">Save settings</button>
      </div>
    </form>
  );
}

function TypographyFields({ label, name, value }: { label: string; name: string; value: Typography }) {
  return <fieldset className="admin-subpanel"><legend>{label}</legend><div className="field-grid"><label className="field">Typeface<select name={`type-${name}-family`} defaultValue={value.family}>{fontFamilies.map((family) => <option key={family} value={family}>{family === "INTER" ? "Inter" : family[0] + family.slice(1).toLowerCase()}</option>)}</select></label><label className="field">Weight<select name={`type-${name}-weight`} defaultValue={value.weight}>{fontWeights.map((weight) => <option key={weight} value={weight}>{weight[0] + weight.slice(1).toLowerCase()}</option>)}</select></label><label className="field">Size (px)<input name={`type-${name}-size`} type="number" min="8" max="96" defaultValue={value.sizePx} required /></label><label className="check-field"><input name={`type-${name}-italic`} type="checkbox" defaultChecked={value.italic} /><span>Italic</span></label></div></fieldset>;
}

function ThemePaletteFields({ theme }: { theme: StorefrontTheme }) {
  return (
    <details className="admin-subpanel">
      <summary>Page palette families</summary>
      <p className="field-hint">
        These five base families are editable per Store. Pages and categories
        inherit them unless a section explicitly overrides a colour.
      </p>
      <div className="admin-stack">
        {baseVisualThemeKeys.map((key) => {
          const palette = theme.pageThemes[key];
          return (
            <fieldset className="theme-palette-fields" key={key}>
              <legend>{themeLabel(key)}</legend>
              <label className="field">
                Accent
                <input
                  name={`theme-${key}-accent`}
                  type="color"
                  defaultValue={palette.accent}
                />
              </label>
              <label className="field">
                Soft surface
                <input
                  name={`theme-${key}-soft`}
                  type="color"
                  defaultValue={palette.soft}
                />
              </label>
              <label className="field">
                Deep ink
                <input
                  name={`theme-${key}-deep`}
                  type="color"
                  defaultValue={palette.deep}
                />
              </label>
              <label className="field">
                Contrast text
                <input
                  name={`theme-${key}-contrast`}
                  type="color"
                  defaultValue={palette.contrast}
                />
              </label>
            </fieldset>
          );
        })}
      </div>
    </details>
  );
}

function themeLabel(key: (typeof baseVisualThemeKeys)[number]) {
  return {
    CORAL: "Pastel peach",
    SKY: "Pastel blue",
    MIDNIGHT: "Pastel green",
    VIOLET: "Pastel lilac",
    AMBER: "Pastel butter",
  }[key];
}
