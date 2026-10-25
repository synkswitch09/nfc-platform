"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUploadField } from "@/components/media-upload-field";
import { storefrontIconSlots } from "@/lib/storefront-icons";
import {
  parseFooterLinks,
  footerSocialProfiles,
  parseHeaderLinks,
  type FooterConfig,
  type HeaderConfig,
} from "@/lib/site-chrome";
import { type TypographyOverride } from "@/lib/typography";

type SocialLinks = Record<string, string | null>;

export function StorefrontChromeForm({
  area,
  header,
  footer,
  socialLinks = {},
  kosykinLayout = false,
}: {
  kosykinLayout?: boolean;
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
  const [compactLogoUrl, setCompactLogoUrl] = useState(header?.compactLogoUrl ?? "");
  const [iconUrls, setIconUrls] = useState(header?.iconUrls ?? {});
  const [socialProfiles, setSocialProfiles] = useState(footer ? footerSocialProfiles(footer, socialLinks) : []);


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
            compactLogoUrl,
            iconUrls,
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
            brandTypography: typographyFromForm(form, "brandTypography", header.brandTypography),
            homeTypography: typographyFromForm(form, "homeTypography", header.homeTypography),
            categoriesTypography: typographyFromForm(form, "categoriesTypography", header.categoriesTypography),
            customLinksTypography: typographyFromForm(form, "customLinksTypography", header.customLinksTypography),
            faqTypography: typographyFromForm(form, "faqTypography", header.faqTypography),
            cartTypography: typographyFromForm(form, "cartTypography", header.cartTypography),
            shopTypography: typographyFromForm(form, "shopTypography", header.shopTypography),
            signInTypography: typographyFromForm(form, "signInTypography", header.signInTypography),
            accountTypography: typographyFromForm(form, "accountTypography", header.accountTypography),
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
              support: kosykinLayout ? {
                ...footer.support,
                enabled: form.get("supportEnabled") === "on",
                headline: form.get("supportHeadline"),
                copy: form.get("supportCopy"),
                responseText: form.get("supportResponseText"),
                contactLabel: form.get("supportContactLabel"),
                instagramLabel: form.get("supportInstagramLabel"),
                instagramHref: form.get("supportInstagramHref"),
                instagramVisible: form.get("supportInstagramVisible") === "on",
                backgroundColour: form.get("supportBackgroundColour"),
                textColour: form.get("supportTextColour"),
                headlineTypography: typographyFromForm(form, "supportHeadlineTypography", footer.support.headlineTypography),
                copyTypography: typographyFromForm(form, "supportCopyTypography", footer.support.copyTypography),
                buttonTypography: typographyFromForm(form, "supportButtonTypography", footer.support.buttonTypography),
              } : footer.support,
              logoTreatment: form.get("logoTreatment") ?? footer.logoTreatment,
              logoUrl,
              copyright: form.get("copyright"),
              tagline: form.get("tagline") ?? footer.tagline,
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
              taglineTypography: typographyFromForm(form, "taglineTypography", footer.taglineTypography),
              copyrightTypography: typographyFromForm(form, "copyrightTypography", footer.copyrightTypography),
              customLinksTypography: typographyFromForm(form, "customLinksTypography", footer.customLinksTypography),
              termsTypography: typographyFromForm(form, "termsTypography", footer.termsTypography),
              privacyTypography: typographyFromForm(form, "privacyTypography", footer.privacyTypography),
              includeManagedPages: form.get("includeManagedPages") === "on",
              policyLinks: parseFooterLinks(String(form.get("policyLinks") ?? ""), footer.policyLinks),
              socialProfiles: socialProfiles.map((row, order) => ({ ...row, order })),
            }
          : null;
    const payload = {
      area,
      config,
      ...(area === "footer"
        ? {
            socialLinks: Object.fromEntries(["instagram", "tumblr", "facebook", "tiktok", "linkedin"].map(platform => [platform, socialLinks[platform] ?? ""])),
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
        {area === "header" && <MediaUploadField
          uploadEndpoint="/api/admin/settings/images"
          label="Compact header logo (mobile and narrow screens)"
          name="compactLogoUrl"
          value={compactLogoUrl}
          onChange={setCompactLogoUrl}
        />}
        {area === "header" && header ? (
          <><HeaderFields config={header} /><details className="admin-panel"><summary>Storefront icons (all pages)</summary><p>Upload or select an icon for each control. These settings apply across this store. Empty fields use the brand defaults. Section-specific icon uploads take priority. Footer social profile icons can be overridden in Footer.</p>{Object.entries(storefrontIconSlots).map(([slot, label]) => <MediaUploadField key={slot} uploadEndpoint="/api/admin/settings/images" label={label} name={`icon-${slot}`} value={iconUrls[slot] || ''} onChange={value => setIconUrls(current => ({ ...current, [slot]: value }))} />)}</details></>
        ) : footer ? (
          <FooterFields
            config={footer}
            kosykinLayout={kosykinLayout}
            socialProfiles={socialProfiles}
            onSocialProfilesChange={setSocialProfiles}
          />
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
      <IndividualTypographyPanel
        title="Individual header text"
        description="These settings override the default above for only the selected text. Category names use the Categories setting."
        fields={[
          ["brandTypography", "Store name"],
          ["homeTypography", "Home"],
          ["categoriesTypography", "Category names"],
          ["customLinksTypography", "Custom navigation links"],
          ["faqTypography", "FAQs"],
          ["cartTypography", "Cart"],
          ["shopTypography", "Shop button"],
          ["signInTypography", "Sign in button"],
          ["accountTypography", "Account button"],
        ]}
        values={{
          brandTypography: config.brandTypography,
          homeTypography: config.homeTypography,
          categoriesTypography: config.categoriesTypography,
          customLinksTypography: config.customLinksTypography,
          faqTypography: config.faqTypography,
          cartTypography: config.cartTypography,
          shopTypography: config.shopTypography,
          signInTypography: config.signInTypography,
          accountTypography: config.accountTypography,
        }}
      />
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
  kosykinLayout,
  socialProfiles,
  onSocialProfilesChange,
}: {
  config: FooterConfig;
  kosykinLayout: boolean;
  socialProfiles: NonNullable<FooterConfig["socialProfiles"]>;
  onSocialProfilesChange: (rows: NonNullable<FooterConfig["socialProfiles"]>) => void;
}) {
  return (
    <>
      {kosykinLayout && <section className="admin-panel">
        <h3>Support panel — cream area</h3>
        <p>This panel and the legal strip form one shared footer on every Kosykin page. Social networks below appear in the cream area. Contact us always opens Help &amp; requests.</p>
        <Check name="supportEnabled" label="Show support panel" checked={config.support.enabled} />
        <div className="field-grid">
          <Text name="supportHeadline" label="Support heading" value={config.support.headline} />
          <label className="field">Support copy<textarea name="supportCopy" defaultValue={config.support.copy} /></label>
          <Text name="supportResponseText" label="Reply time text (empty to hide)" value={config.support.responseText} />
          <Text name="supportContactLabel" label="Contact button label" value={config.support.contactLabel} />
          <Text name="supportInstagramLabel" label="Instagram message button label" value={config.support.instagramLabel} />
          <Text name="supportInstagramHref" label="Instagram message destination URL" type="url" value={config.support.instagramHref} />
          <Colour name="supportBackgroundColour" label="Support background" value={config.support.backgroundColour} />
          <Colour name="supportTextColour" label="Support text" value={config.support.textColour} />
        </div>
        <small>Use a full https:// link for Instagram messaging. An empty URL leaves a non-clickable preview. This is separate from the Instagram profile link under Social networks.</small>
        <Check name="supportInstagramVisible" label="Show Instagram message button" checked={config.support.instagramVisible} />
        <IndividualTypographyPanel title="Support typography" description="Override the heading, copy or buttons independently." fields={[["supportHeadlineTypography", "Heading"], ["supportCopyTypography", "Copy and reply time"], ["supportButtonTypography", "Buttons"]]} values={{ supportHeadlineTypography: config.support.headlineTypography, supportCopyTypography: config.support.copyTypography, supportButtonTypography: config.support.buttonTypography }} />
      </section>}
      <div className="field-grid">
        {!kosykinLayout && <Select name="logoTreatment" label="Logo treatment" value={config.logoTreatment} options={[["ORIGINAL", "Original uploaded colours"], ["CREAM", "Cream silhouette"]]} />}
        <Text name="copyright" label="Copyright" value={config.copyright} />
        <Text name="termsLabel" label="Terms label" value={config.termsLabel} />
        <Text
          name="privacyLabel"
          label="Privacy label"
          value={config.privacyLabel}
        />
        {!kosykinLayout && <label className="field wide">
          Tagline
          <textarea name="tagline" defaultValue={config.tagline} />
        </label>}
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
        <Check name="includeManagedPages" label="Include pages marked for the footer" checked={config.includeManagedPages} />
        <Check name="showTerms" label="Show Terms" checked={config.showTerms} />
        <Check
          name="showPrivacy"
          label="Show Privacy"
          checked={config.showPrivacy}
        />
      </div>
      <h3>Policy submenu</h3>
      <label className="field">Policy submenu links<textarea name="policyLinks" defaultValue={[...config.policyLinks].sort((a,b) => a.order-b.order).map(link => `${link.label} | ${link.href}`).join("\n")} /><small>One per line: Label | /page. Shown on Terms &amp; Conditions and the policy pages listed here, except Privacy Policy.</small></label>
      <h3>Social networks</h3>
      <p>Add any network, choose its icon and destination, then reorder or hide it. Instagram and Facebook also control the Home buttons. Keep those network names as Instagram and Facebook. An icon without a URL remains a decorative preview.</p>
      <button type="button" className="button secondary" disabled={socialProfiles.length >= 24} onClick={() => onSocialProfilesChange([...socialProfiles, { id: crypto.randomUUID(), label: "New network", href: "", iconUrl: "", visible: true, order: socialProfiles.length }])}>Add social network</button>
      <div className="admin-stack compact-stack">
        {socialProfiles.map((row, index) => {
          const update = (patch: Partial<typeof row>) => onSocialProfilesChange(socialProfiles.map(item => item.id === row.id ? { ...item, ...patch } : item));
          const move = (offset: number) => { const rows = [...socialProfiles]; [rows[index], rows[index + offset]] = [rows[index + offset], rows[index]]; onSocialProfilesChange(rows); };
          return <section className="admin-panel" key={row.id} aria-label={`Social network ${index + 1}`}>
            <div className="field-grid">
              <label className="field">Network name<input aria-label={`Network ${index + 1} name`} value={row.label} maxLength={60} required onChange={e => update({ label: e.target.value })} /></label>
              <label className="field">Destination URL<input aria-label={`Network ${index + 1} URL`} type="url" value={row.href} onChange={e => update({ href: e.target.value })} /></label>
            </div>
            <MediaUploadField uploadEndpoint="/api/admin/settings/images" label={`${row.label} icon`} name={`social-${row.id}`} value={row.iconUrl} onChange={iconUrl => update({ iconUrl })} />
            <div className="check-row"><label><input type="checkbox" checked={row.visible} onChange={e => update({ visible: e.target.checked })} /> Visible</label>
              <button type="button" className="button secondary" disabled={index === 0} onClick={() => move(-1)}>Move earlier</button>
              <button type="button" className="button secondary" disabled={index === socialProfiles.length - 1} onClick={() => move(1)}>Move later</button>
              <button type="button" className="button secondary" onClick={() => onSocialProfilesChange(socialProfiles.filter(item => item.id !== row.id))}>Remove network</button>
            </div>
          </section>;
        })}
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
      <IndividualTypographyPanel
        title="Individual footer text"
        description="Set a style for one text field only. Leave an option on Inherit to keep the footer default."
        fields={[
          ...(!kosykinLayout ? [["taglineTypography", "Tagline"] as [string, string]] : []),
          ["copyrightTypography", "Copyright"],
          ["customLinksTypography", "Custom footer links"],
          ["termsTypography", "Terms label"],
          ["privacyTypography", "Privacy label"],
        ]}
        values={{
          taglineTypography: config.taglineTypography,
          copyrightTypography: config.copyrightTypography,
          customLinksTypography: config.customLinksTypography,
          termsTypography: config.termsTypography,
          privacyTypography: config.privacyTypography,
        }}
      />
    </>
  );
}

function typographyFromForm(
  form: FormData,
  prefix: string,
  fallback: TypographyOverride,
): TypographyOverride {
  return {
    family: String(form.get(`${prefix}-family`) ?? fallback.family) as TypographyOverride["family"],
    weight: String(form.get(`${prefix}-weight`) ?? fallback.weight) as TypographyOverride["weight"],
    italic: String(form.get(`${prefix}-italic`) ?? fallback.italic) as TypographyOverride["italic"],
    lineHeight: form.get(`${prefix}-lineHeight`) ? Number(form.get(`${prefix}-lineHeight`)) : undefined,
    letterSpacingEm: form.get(`${prefix}-letterSpacingEm`) ? Number(form.get(`${prefix}-letterSpacingEm`)) : undefined,
    sizePx: form.get(`${prefix}-size`) === "" ? null : Number(form.get(`${prefix}-size`) ?? fallback.sizePx),
  };
}

function IndividualTypographyPanel({
  title,
  description,
  fields,
  values,
}: {
  title: string;
  description: string;
  fields: Array<[string, string]>;
  values: Record<string, TypographyOverride>;
}) {
  return (
    <details className="admin-panel compact-panel typography-overrides">
      <summary>{title}</summary>
      <p>{description}</p>
      {fields.map(([prefix, label]) => (
        <fieldset key={prefix} className="typography-fieldset">
          <legend>{label}</legend>
          <TypographyOverrideFields prefix={prefix} value={values[prefix]} />
        </fieldset>
      ))}
    </details>
  );
}

function TypographyOverrideFields({
  prefix,
  value,
}: {
  prefix: string;
  value: TypographyOverride;
}) {
  return (
    <div className="field-grid four">
      <Select
        name={`${prefix}-family`}
        label="Typeface"
        value={value.family}
        options={[
          ["INHERIT", "Inherit"],
          ["INTER", "Inter"],
          ["SYSTEM", "System"],
          ["SERIF", "Serif"],
          ["MONO", "Monospace"],
          ["BEBAS_NEUE", "Bebas Neue"], ["CAVEAT", "Caveat"],
        ]}
      />
      <Select
        name={`${prefix}-weight`}
        label="Weight"
        value={value.weight}
        options={[
          ["INHERIT", "Inherit"],
          ["THIN", "Thin"],
          ["LIGHT", "Light"],
          ["REGULAR", "Regular"],
          ["MEDIUM", "Medium"],
          ["BOLD", "Bold"],
          ["BLACK", "Black / Heavy"],
        ]}
      />
      <Select
        name={`${prefix}-italic`}
        label="Style"
        value={value.italic}
        options={[
          ["INHERIT", "Inherit"],
          ["NORMAL", "Normal"],
          ["ITALIC", "Italic"],
        ]}
      />
      <label className="field">
        Size (px)
        <input
          name={`${prefix}-size`}
          type="number"
          min="8"
          max="96"
          defaultValue={value.sizePx ?? ""}
          placeholder="Inherit"
        />
      </label>
      <label className="field">Line height<input name={`${prefix}-lineHeight`} type="number" min="0.8" max="3" step="0.05" defaultValue={value.lineHeight ?? ""} placeholder="Inherit" /></label>
      <label className="field">Letter spacing (em)<input name={`${prefix}-letterSpacingEm`} type="number" min="-0.2" max="0.5" step="0.005" defaultValue={value.letterSpacingEm ?? ""} placeholder="Inherit" /></label>
    </div>
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
