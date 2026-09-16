"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUploadField } from "@/components/media-upload-field";
import {
  parseFooterLinks,
  parseHeaderLinks,
  type FooterConfig,
  type HeaderConfig,
} from "@/lib/site-chrome";

type SocialLinks = Record<string, string | null>;

export function StorefrontChromeForm({
  area,
  header,
  footer,
  socialLinks = {},
}: {
  area: "header" | "footer";
  header?: HeaderConfig;
  footer?: FooterConfig;
  socialLinks?: SocialLinks;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [logoUrl, setLogoUrl] = useState(
    area === "header" ? (header?.logoUrl ?? "") : (footer?.logoUrl ?? ""),
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const config =
      area === "header" && header
        ? {
            ...header,
            logoUrl,
            homeLabel: form.get("homeLabel"),
            categoriesLabel: form.get("categoriesLabel"),
            faqLabel: form.get("faqLabel"),
            faqHref: form.get("faqHref"),
            shopLabel: form.get("shopLabel"),
            shopHref: form.get("shopHref"),
            signInLabel: form.get("signInLabel"),
            signInHref: form.get("signInHref"),
            accountLabel: form.get("accountLabel"),
            accountHref: form.get("accountHref"),
            showHome: form.get("showHome") === "on",
            showCategories: form.get("showCategories") === "on",
            showFaq: form.get("showFaq") === "on",
            showCart: form.get("showCart") === "on",
            showLanguage: form.get("showLanguage") === "on",
            homeOrder: Number(form.get("homeOrder")),
            categoriesOrder: Number(form.get("categoriesOrder")),
            faqOrder: Number(form.get("faqOrder")),
            cartOrder: Number(form.get("cartOrder")),
            customLinks: parseHeaderLinks(
              String(form.get("customHeaderLinks") ?? ""),
              header.customLinks,
            ),
            backgroundColour: form.get("backgroundColour"),
            textColour: form.get("textColour"),
            activeColour: form.get("activeColour"),
            fontFamily: form.get("fontFamily"),
            textSize: form.get("textSize"),
            textSizePx: Number(form.get("textSizePx")),
            textWeight: form.get("textWeight"),
            textItalic: form.get("textItalic") === "on",
            shopBackgroundColour: form.get("shopBackgroundColour"),
            shopTextColour: form.get("shopTextColour"),
            shopBorderColour: form.get("shopBorderColour"),
            accountBackgroundColour: form.get("accountBackgroundColour"),
            accountTextColour: form.get("accountTextColour"),
            accountBorderColour: form.get("accountBorderColour"),
          }
        : footer
          ? {
              ...footer,
              logoUrl,
              copyright: form.get("copyright"),
              tagline: form.get("tagline"),
              termsLabel: form.get("termsLabel"),
              privacyLabel: form.get("privacyLabel"),
              showTerms: form.get("showTerms") === "on",
              showPrivacy: form.get("showPrivacy") === "on",
              customLinks: parseFooterLinks(
                String(form.get("customFooterLinks") ?? ""),
                footer.customLinks,
              ),
              backgroundColour: form.get("backgroundColour"),
              textColour: form.get("textColour"),
              linkColour: form.get("linkColour"),
              borderColour: form.get("borderColour"),
              fontFamily: form.get("fontFamily"),
              textSizePx: Number(form.get("textSizePx")),
              textWeight: form.get("textWeight"),
              textItalic: form.get("textItalic") === "on",
            }
          : null;
    const payload = {
      area,
      config,
      ...(area === "footer"
        ? {
            socialLinks: {
              instagram: form.get("instagram"),
              facebook: form.get("facebook"),
              tiktok: form.get("tiktok"),
              linkedin: form.get("linkedin"),
            },
          }
        : {}),
    };
    const response = await fetch("/api/admin/storefront", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(result.error ?? "Storefront settings could not be saved");
      return;
    }
    setMessage("Changes saved");
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>{area === "header" ? "Header identity" : "Footer identity"}</h2>
            <p>Content and media used only in this storefront area.</p>
          </div>
        </div>
        <MediaUploadField
          uploadEndpoint="/api/admin/settings/images"
          disabledMessage="Store media upload is unavailable."
          label={`${area === "header" ? "Header" : "Footer"} logo`}
          name="logoUrl"
          value={logoUrl}
          onChange={setLogoUrl}
        />
        {area === "header" && header ? (
          <HeaderFields config={header} />
        ) : footer ? (
          <FooterFields config={footer} socialLinks={socialLinks} />
        ) : null}
      </section>
      {message && (
        <div
          className={message === "Changes saved" ? "notice" : "form-error"}
          role="status"
        >
          {message}
        </div>
      )}
      <div className="admin-form-actions">
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : `Save ${area}`}
        </button>
      </div>
    </form>
  );
}

function HeaderFields({ config }: { config: HeaderConfig }) {
  return (
    <>
      <h3>Navigation</h3>
      <div className="field-grid three">
        <Text name="homeLabel" label="Home label" value={config.homeLabel} />
        <Text
          name="categoriesLabel"
          label="Categories label"
          value={config.categoriesLabel}
        />
        <Text name="faqLabel" label="FAQ label" value={config.faqLabel} />
        <Text name="faqHref" label="FAQ destination" value={config.faqHref} />
        <Text name="shopLabel" label="Shop label" value={config.shopLabel} />
        <Text
          name="shopHref"
          label="Shop destination"
          value={config.shopHref}
        />
        <Text
          name="signInLabel"
          label="Sign in label"
          value={config.signInLabel}
        />
        <Text
          name="signInHref"
          label="Sign in destination"
          value={config.signInHref}
        />
        <Text
          name="accountLabel"
          label="Account label"
          value={config.accountLabel}
        />
        <Text
          name="accountHref"
          label="Account destination"
          value={config.accountHref}
        />
      </div>
      <div className="check-row">
        <Check name="showHome" label="Show Home" checked={config.showHome} />
        <Check
          name="showCategories"
          label="Show Categories"
          checked={config.showCategories}
        />
        <Check name="showFaq" label="Show FAQ" checked={config.showFaq} />
        <Check name="showCart" label="Show Cart" checked={config.showCart} />
        <Check
          name="showLanguage"
          label="Show language"
          checked={config.showLanguage}
        />
      </div>
      <h3>Order and custom links</h3>
      <div className="field-grid">
        <NumberField
          name="homeOrder"
          label="Home order"
          value={config.homeOrder}
        />
        <NumberField
          name="categoriesOrder"
          label="Categories order"
          value={config.categoriesOrder}
        />
        <NumberField
          name="faqOrder"
          label="FAQ order"
          value={config.faqOrder}
        />
        <NumberField
          name="cartOrder"
          label="Cart order"
          value={config.cartOrder}
        />
        <label className="field wide">
          Custom navigation links
          <textarea
            name="customHeaderLinks"
            defaultValue={config.customLinks
              .sort((a, b) => a.order - b.order)
              .map((link) => `${link.label} | ${link.href} | ${link.audience}`)
              .join("\n")}
            placeholder="About | /about | ALL"
          />
          <small>
            One per line: Label | /destination | ALL, GUEST or AUTHENTICATED.
          </small>
        </label>
      </div>
      <h3>Text</h3>
      <div className="field-grid">
        <Select
          name="fontFamily"
          label="Header typeface"
          value={config.fontFamily}
          options={[
            ["INHERIT", "Store default"],
            ["INTER", "Inter"],
            ["SANS", "Sans serif"],
            ["SERIF", "Serif"],
            ["MONO", "Monospace"],
          ]}
        />
        <Select name="textWeight" label="Text weight" value={config.textWeight} options={[["THIN", "Thin"], ["LIGHT", "Light"], ["REGULAR", "Regular"], ["MEDIUM", "Medium"], ["BOLD", "Bold"], ["BLACK", "Black / Heavy"]]} />
        <NumberField name="textSizePx" label="Text size (px)" value={config.textSizePx} />
        <Check name="textItalic" label="Italic" checked={config.textItalic} />
        <Select
          name="textSize"
          label="Header text size"
          value={config.textSize}
          options={[
            ["SMALL", "Small"],
            ["STANDARD", "Standard"],
            ["LARGE", "Large"],
          ]}
        />
      </div>
      <h3>Colours</h3>
      <div className="field-grid three">
        <Colour
          name="backgroundColour"
          label="Background"
          value={config.backgroundColour}
        />
        <Colour
          name="textColour"
          label="Navigation text"
          value={config.textColour}
        />
        <Colour
          name="activeColour"
          label="Active item"
          value={config.activeColour}
        />
        <Colour
          name="shopBackgroundColour"
          label="Shop background"
          value={config.shopBackgroundColour}
        />
        <Colour
          name="shopTextColour"
          label="Shop text"
          value={config.shopTextColour}
        />
        <Colour
          name="shopBorderColour"
          label="Shop border"
          value={config.shopBorderColour}
        />
        <Colour
          name="accountBackgroundColour"
          label="Account background"
          value={config.accountBackgroundColour}
        />
        <Colour
          name="accountTextColour"
          label="Account text"
          value={config.accountTextColour}
        />
        <Colour
          name="accountBorderColour"
          label="Account border"
          value={config.accountBorderColour}
        />
      </div>
    </>
  );
}

function FooterFields({
  config,
  socialLinks,
}: {
  config: FooterConfig;
  socialLinks: SocialLinks;
}) {
  return (
    <>
      <div className="field-grid">
        <Text name="copyright" label="Copyright" value={config.copyright} />
        <Text name="termsLabel" label="Terms label" value={config.termsLabel} />
        <Text
          name="privacyLabel"
          label="Privacy label"
          value={config.privacyLabel}
        />
        <label className="field wide">
          Tagline
          <textarea name="tagline" defaultValue={config.tagline} />
        </label>
        <label className="field wide">
          Custom footer links
          <textarea
            name="customFooterLinks"
            defaultValue={config.customLinks
              .sort((a, b) => a.order - b.order)
              .map((link) => `${link.label} | ${link.href}`)
              .join("\n")}
            placeholder="Contact | /contact"
          />
          <small>
            One per line: Label | /destination or https://destination.
          </small>
        </label>
      </div>
      <div className="check-row">
        <Check name="showTerms" label="Show Terms" checked={config.showTerms} />
        <Check
          name="showPrivacy"
          label="Show Privacy"
          checked={config.showPrivacy}
        />
      </div>
      <h3>Social links</h3>
      <div className="field-grid">
        {(["instagram", "facebook", "tiktok", "linkedin"] as const).map(
          (platform) => (
            <Text
              key={platform}
              name={platform}
              label={`${platform[0].toUpperCase()}${platform.slice(1)} URL`}
              value={socialLinks[platform] ?? ""}
              type="url"
            />
          ),
        )}
      </div>
      <h3>Colours</h3>
      <div className="field-grid">
        <Colour
          name="backgroundColour"
          label="Background"
          value={config.backgroundColour}
        />
        <Colour name="textColour" label="Text" value={config.textColour} />
        <Colour
          name="linkColour"
          label="Links and icons"
          value={config.linkColour}
        />
        <Colour
          name="borderColour"
          label="Top border"
          value={config.borderColour}
        />
      </div>
      <h3>Text</h3>
      <div className="field-grid">
        <Select name="fontFamily" label="Footer typeface" value={config.fontFamily} options={[["INHERIT", "Store default"], ["INTER", "Inter"], ["SANS", "Sans serif"], ["SERIF", "Serif"], ["MONO", "Monospace"]]} />
        <Select name="textWeight" label="Text weight" value={config.textWeight} options={[["THIN", "Thin"], ["LIGHT", "Light"], ["REGULAR", "Regular"], ["MEDIUM", "Medium"], ["BOLD", "Bold"], ["BLACK", "Black / Heavy"]]} />
        <NumberField name="textSizePx" label="Text size (px)" value={config.textSizePx} />
        <Check name="textItalic" label="Italic" checked={config.textItalic} />
      </div>
    </>
  );
}

function Text({
  name,
  label,
  value,
  type,
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
}) {
  return (
    <label className="field">
      {label}
      <input name={name} type={type} defaultValue={value} />
    </label>
  );
}

function NumberField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <label className="field">
      {label}
      <input name={name} type="number" min="0" max={name === "textSizePx" ? "96" : "100"} defaultValue={value} />
    </label>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="field">
      {label}
      <select name={name} defaultValue={value}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="check-field">
      <input type="checkbox" name={name} defaultChecked={checked} />
      <span>{label}</span>
    </label>
  );
}

function Colour({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  const [colour, setColour] = useState(value);
  return (
    <label className="field colour-field">
      {label}
      <span>
        <input
          type="color"
          aria-label={`${label} picker`}
          value={colour || "#ffffff"}
          onChange={(event) => setColour(event.target.value)}
        />
        <input
          name={name}
          value={colour}
          placeholder="Use base theme"
          pattern="#[0-9A-Fa-f]{6}"
          onChange={(event) => setColour(event.target.value)}
        />
      </span>
    </label>
  );
}
