"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUploadField } from "@/components/media-upload-field";

export type ContentPageEditorInitial = {
  id?: string;
  name: string;
  slug: string;
  kind: "HOME" | "CAMPAIGN" | "COLLECTION" | "LEGAL";
  status: "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";
  sortOrder: number;
  showInHeader: boolean;
  showInFooter: boolean;
  headerLabel: string;
  footerLabel: string;
  navigationOrder: number;
  visualTheme: "CORAL" | "SKY" | "MIDNIGHT" | "VIOLET" | "AMBER";
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexable: boolean;
};

export function ContentPageEditor({
  initial,
}: {
  initial: ContentPageEditorInitial;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [ogImageUrl, setOgImageUrl] = useState(initial.ogImageUrl);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      slug: form.get("slug"),
      kind: form.get("kind"),
      status: form.get("status"),
      sortOrder: Number(form.get("sortOrder")),
      showInHeader: form.get("showInHeader") === "on",
      showInFooter: form.get("showInFooter") === "on",
      headerLabel: form.get("headerLabel"),
      footerLabel: form.get("footerLabel"),
      navigationOrder: Number(form.get("navigationOrder")),
      visualTheme: form.get("visualTheme"),
      seoTitle: form.get("seoTitle"),
      seoDescription: form.get("seoDescription"),
      ogImageUrl: form.get("ogImageUrl"),
      canonicalUrl: form.get("canonicalUrl"),
      indexable: form.get("indexable") === "on",
    };
    const response = await fetch(
      initial.id ? `/api/admin/pages/${initial.id}` : "/api/admin/pages",
      {
        method: initial.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok)
      return setMessage(result.error ?? "Page could not be saved");
    setMessage("Page saved");
    if (!initial.id) router.replace(`/admin/pages/${result.page.id}`);
    else router.refresh();
  }
  async function remove() {
    if (
      !initial.id ||
      !window.confirm("Delete this page permanently? This cannot be undone.")
    )
      return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/pages/${initial.id}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(result.error ?? "Page could not be deleted");
      return;
    }
    router.push("/admin/pages");
    router.refresh();
  }
  return (
    <form className="admin-form" onSubmit={save}>
      <section className="admin-panel" id="general">
        <div className="panel-heading">
          <div>
            <h2>General</h2>
            <p>
              Identity and lifecycle only. Page content is managed in the
              Sections builder below.
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
              readOnly={initial.kind === "HOME"}
              required
            />
          </label>
          <label className="field">
            Page type
            <select
              name="kind"
              defaultValue={initial.kind}
              disabled={Boolean(initial.id)}
            >
              <option value="HOME">Home</option>
              <option value="CAMPAIGN">Campaign</option>
              <option value="COLLECTION">Standard page / FAQ</option>
              <option value="LEGAL">Legal</option>
            </select>
            {initial.id && (
              <input type="hidden" name="kind" value={initial.kind} />
            )}
          </label>
          <label className="field">
            Status
            <select name="status" defaultValue={initial.status}>
              <option>DRAFT</option>
              <option>PUBLISHED</option>
              <option>HIDDEN</option>
              <option>ARCHIVED</option>
            </select>
          </label>
          <label className="field">
            Display order
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={initial.sortOrder}
            />
          </label>
          <label className="field">
            Base visual theme
            <select name="visualTheme" defaultValue={initial.visualTheme}>
              <option value="CORAL">Pastel peach</option>
              <option value="SKY">Pastel blue</option>
              <option value="MIDNIGHT">Pastel green</option>
              <option value="VIOLET">Pastel lilac</option>
              <option value="AMBER">Pastel butter</option>
            </select>
          </label>
        </div>
      </section>
      {initial.kind !== "HOME" && (
        <section className="admin-panel" id="placement">
          <div className="panel-heading"><div><h2>Where this page appears</h2><p>Choose navigation placement here. Section buttons can link to this page independently.</p></div></div>
          <div className="field-grid">
            <label className="check-field"><input name="showInHeader" type="checkbox" defaultChecked={initial.showInHeader} /><span>Show in main navigation</span></label>
            <label className="field">Main navigation label<input name="headerLabel" defaultValue={initial.headerLabel} maxLength={60} placeholder={initial.name} /></label>
            <label className="check-field"><input name="showInFooter" type="checkbox" defaultChecked={initial.showInFooter} /><span>Show in footer</span></label>
            <label className="field">Footer label<input name="footerLabel" defaultValue={initial.footerLabel} maxLength={60} placeholder={initial.name} /></label>
            <label className="field">Navigation order<input name="navigationOrder" type="number" min="0" defaultValue={initial.navigationOrder} /><small>Lower numbers appear first in both menus.</small></label>
          </div>
        </section>
      )}
      <section className="admin-panel" id="seo">
        <div className="panel-heading">
          <div>
            <h2>SEO</h2>
            <p>Search and sharing metadata for this page.</p>
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
          <label className="field">
            Canonical URL
            <input
              name="canonicalUrl"
              type="url"
              defaultValue={initial.canonicalUrl}
            />
          </label>
          <label className="field wide">
            Meta description
            <textarea
              name="seoDescription"
              defaultValue={initial.seoDescription}
              maxLength={170}
            />
          </label>
          <MediaUploadField
            uploadEndpoint={
              initial.id ? `/api/admin/pages/${initial.id}/images` : undefined
            }
            disabledMessage="Save the page first, then upload its images."
            label="Social sharing image"
            name="ogImageUrl"
            value={ogImageUrl}
            onChange={setOgImageUrl}
          />
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            name="indexable"
            defaultChecked={initial.indexable}
          />
          <span>Allow search engines to index this page</span>
        </label>
      </section>
      {message && (
        <div
          className={message === "Page saved" ? "notice" : "form-error"}
          role="status"
        >
          {message}
        </div>
      )}
      <div className="admin-form-actions">
        {initial.id && initial.kind !== "HOME" && (
          <button
            className="button danger"
            type="button"
            disabled={pending}
            onClick={remove}
          >
            Delete page
          </button>
        )}
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : "Save page settings"}
        </button>
      </div>
    </form>
  );
}
