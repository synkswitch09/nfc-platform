"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CategoryBenefit,
  CategoryFaq,
  CategorySection,
  CategoryStep,
  CategoryUseCase,
} from "@/lib/category-content";
import { CategoryImageUploadField } from "@/components/category-image-upload-field";

export type CategoryEditorInitial = {
  id?: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  icon: string;
  imageUrl: string;
  cardTitle: string;
  cardText: string;
  cardImageUrl: string;
  cardImageAlt: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageAlt: string;
  secondaryImageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";
  sortOrder: number;
  showOnHomepage: boolean;
  showInNavigation: boolean;
  showInShop: boolean;
  showLanding: boolean;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexable: boolean;
  finalCtaEyebrow: string;
  finalCtaHeadline: string;
  finalCtaDescription: string;
  finalCtaLabel: string;
  finalCtaHref: string;
  visualTheme: "CORAL" | "SKY" | "MIDNIGHT" | "VIOLET" | "AMBER";
  landingLayout:
    | "EDITORIAL"
    | "ASSURANCE"
    | "EXECUTIVE"
    | "MOMENTUM"
    | "JOURNEY";
  benefits: CategoryBenefit[];
  useCases: CategoryUseCase[];
  howItWorks: CategoryStep[];
  contentSections: CategorySection[];
  faq: CategoryFaq[];
};

const visualThemeOptions: Array<{
  value: CategoryEditorInitial["visualTheme"];
  label: string;
  colours: string;
}> = [
  {
    value: "CORAL",
    label: "Pastel peach",
    colours: "peach, cream and charcoal",
  },
  {
    value: "SKY",
    label: "Pastel sky",
    colours: "powder blue, mist and charcoal",
  },
  {
    value: "MIDNIGHT",
    label: "Pastel mint",
    colours: "mint, soft green and charcoal",
  },
  {
    value: "VIOLET",
    label: "Pastel lilac",
    colours: "lilac, lavender and charcoal",
  },
  {
    value: "AMBER",
    label: "Pastel butter",
    colours: "butter yellow, cream and charcoal",
  },
];

export function CategoryEditor({
  initial,
}: {
  initial: CategoryEditorInitial;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState(initial.cardImageUrl);
  const [ogImageUrl, setOgImageUrl] = useState(initial.ogImageUrl);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const payload = {
      name: text("name"),
      slug: text("slug"),
      shortDescription: text("shortDescription"),
      description: text("description"),
      icon: text("icon"),
      imageUrl: initial.imageUrl,
      cardTitle: text("cardTitle"),
      cardText: text("cardText"),
      cardImageUrl: text("cardImageUrl") ?? "",
      cardImageAlt: text("cardImageAlt"),
      heroEyebrow: initial.heroEyebrow,
      heroHeadline: initial.heroHeadline,
      heroDescription: initial.heroDescription,
      heroImageUrl: initial.heroImageUrl,
      heroImageAlt: initial.heroImageAlt,
      secondaryImageUrl: initial.secondaryImageUrl,
      ctaLabel: initial.ctaLabel,
      ctaHref: initial.ctaHref,
      secondaryCtaLabel: initial.secondaryCtaLabel,
      secondaryCtaHref: initial.secondaryCtaHref,
      finalCtaEyebrow: initial.finalCtaEyebrow,
      finalCtaHeadline: initial.finalCtaHeadline,
      finalCtaDescription: initial.finalCtaDescription,
      finalCtaLabel: initial.finalCtaLabel,
      finalCtaHref: initial.finalCtaHref,
      visualTheme: form.get("visualTheme"),
      landingLayout: initial.landingLayout,
      status: form.get("status"),
      sortOrder: Number(form.get("sortOrder")),
      showOnHomepage: form.get("showOnHomepage") === "on",
      showInNavigation: form.get("showInNavigation") === "on",
      showInShop: form.get("showInShop") === "on",
      showLanding: form.get("showLanding") === "on",
      seoTitle: text("seoTitle"),
      seoDescription: text("seoDescription"),
      ogImageUrl: text("ogImageUrl") ?? "",
      canonicalUrl: text("canonicalUrl") ?? "",
      indexable: form.get("indexable") === "on",
      benefits: initial.benefits,
      useCases: initial.useCases,
      howItWorks: initial.howItWorks,
      contentSections: initial.contentSections,
      faq: initial.faq,
    };
    const response = await fetch(
      initial.id
        ? `/api/admin/categories/${initial.id}`
        : "/api/admin/categories",
      {
        method: initial.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok)
      return setMessage(result.error ?? "Category could not be saved");
    setMessage("Category saved");
    if (!initial.id) router.replace(`/admin/categories/${result.category.id}`);
    else router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <section className="admin-panel" id="general">
        <div className="panel-heading">
          <div>
            <h2>Category settings</h2>
            <p>
              Identity, lifecycle and storefront ordering. Landing content is
              managed separately in the page builder.
            </p>
          </div>
        </div>
        <div className="field-grid three">
          <label className="field">
            Name
            <input name="name" defaultValue={initial.name} required />
          </label>
          <label className="field">
            Slug
            <input
              name="slug"
              defaultValue={initial.slug}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </label>
          <label className="field">
            Icon key
            <input
              name="icon"
              defaultValue={initial.icon}
              placeholder="shield-check"
            />
          </label>
          <label className="field">
            Status
            <select name="status" defaultValue={initial.status}>
              {["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Display order
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={initial.sortOrder}
              required
            />
          </label>
        </div>
        <label className="field">
          Short description
          <textarea
            name="shortDescription"
            defaultValue={initial.shortDescription}
            maxLength={240}
          />
        </label>
        <label className="field">
          Collection description
          <textarea
            name="description"
            defaultValue={initial.description}
            maxLength={5000}
          />
        </label>
        <p className="field-hint">
          The base visual theme supplies pastel defaults. In the page builder,
          each section, button and card can inherit or override those colours.
        </p>
      </section>
      <section className="admin-panel" id="appearance">
        <div className="panel-heading">
          <div>
            <h2>Appearance</h2>
            <p>
              Base theme and how this category is introduced on the Store
              homepage.
            </p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            Base visual theme
            <select name="visualTheme" defaultValue={initial.visualTheme}>
              {visualThemeOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label} — {option.colours}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Card title
            <input name="cardTitle" defaultValue={initial.cardTitle} />
          </label>
          <CategoryImageUploadField
            categoryId={initial.id}
            label="Card image"
            name="cardImageUrl"
            value={cardImageUrl}
            onChange={setCardImageUrl}
          />
          <label className="field">
            Card image alt text
            <input
              name="cardImageAlt"
              defaultValue={initial.cardImageAlt}
              maxLength={160}
            />
          </label>
        </div>
        <label className="field">
          Card text
          <textarea
            name="cardText"
            defaultValue={initial.cardText}
            maxLength={240}
          />
        </label>
      </section>
      <section className="admin-panel" id="visibility">
        <div className="panel-heading">
          <div>
            <h2>Visibility</h2>
            <p>
              These switches affect commerce and discovery only. Existing NFC
              tags remain operational.
            </p>
          </div>
        </div>
        <div className="check-row">
          <Check
            name="showOnHomepage"
            label="Homepage"
            checked={initial.showOnHomepage}
          />
          <Check
            name="showInNavigation"
            label="Navigation"
            checked={initial.showInNavigation}
          />
          <Check
            name="showInShop"
            label="Shop filters"
            checked={initial.showInShop}
          />
          <Check
            name="showLanding"
            label="Public landing"
            checked={initial.showLanding}
          />
        </div>
      </section>
      <section className="admin-panel" id="seo">
        <div className="panel-heading">
          <div>
            <h2>SEO</h2>
            <p>Independent controls for the category landing.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            SEO title
            <input
              name="seoTitle"
              defaultValue={initial.seoTitle}
              maxLength={70}
            />
          </label>
          <CategoryImageUploadField
            categoryId={initial.id}
            label="Social sharing image"
            name="ogImageUrl"
            value={ogImageUrl}
            onChange={setOgImageUrl}
          />
          <label className="field">
            Canonical URL
            <input
              name="canonicalUrl"
              type="url"
              defaultValue={initial.canonicalUrl}
            />
          </label>
        </div>
        <label className="field">
          Meta description
          <textarea
            name="seoDescription"
            defaultValue={initial.seoDescription}
            maxLength={170}
          />
        </label>
        <Check
          name="indexable"
          label="Allow search engines to index this landing"
          checked={initial.indexable}
        />
      </section>
      {!initial.id && (
        <div className="notice">
          Save the category settings first. You will then be redirected to its
          landing page builder.
        </div>
      )}
      {message && (
        <div
          className={message === "Category saved" ? "notice" : "form-error"}
          role="status"
        >
          {message}
        </div>
      )}
      <div className="admin-form-actions">
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : "Save category settings"}
        </button>
      </div>
    </form>
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
