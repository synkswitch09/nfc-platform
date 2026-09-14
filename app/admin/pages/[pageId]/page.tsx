import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentPageEditor,
  type ContentPageEditorInitial,
} from "@/components/content-page-editor";
import { LandingSectionEditor } from "@/components/landing-section-editor";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { PageTranslationEditor } from "@/components/page-translation-editor";

export default async function EditContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { pageId } = await params;
  const { store } = await requireAdminPageContext();
  const page = await db.contentPage.findFirst({
    where: { id: pageId, storeId: store.id, categoryId: null },
    include: {
      translations: true,
      sections: {
        include: { translations: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!page) notFound();
  const fromStorefront =
    (await searchParams).from === "storefront" || page.kind === "HOME";
  const initial: ContentPageEditorInitial = {
    id: page.id,
    name: page.name,
    slug: page.slug,
    kind: page.kind as ContentPageEditorInitial["kind"],
    status: page.status,
    sortOrder: page.sortOrder,
    visualTheme: page.visualTheme,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    ogImageUrl: page.ogImageUrl ?? "",
    canonicalUrl: page.canonicalUrl ?? "",
    indexable: page.indexable,
  };
  const publicHref = page.kind === "HOME" ? "/" : `/${page.slug}`;
  const localizedEditors = store.enabledLocales
    .filter((locale) => locale !== store.defaultLocale)
    .map((locale) => {
      const translation = page.translations.find(
        (item) => item.locale === locale,
      );
      return (
        <PageTranslationEditor
          key={locale}
          pageId={page.id}
          locale={locale}
          localeName={
            new Intl.DisplayNames([store.defaultLocale], {
              type: "language",
            }).of(locale) ?? locale
          }
          missing={
            !translation ||
            page.sections.some(
              (section) =>
                !section.translations.some((item) => item.locale === locale),
            )
          }
          metadata={{
            name: translation?.name ?? page.name,
            seoTitle: translation?.seoTitle ?? page.seoTitle ?? "",
            seoDescription:
              translation?.seoDescription ?? page.seoDescription ?? "",
          }}
          sections={page.sections.map((section) => ({
            id: section.id,
            type: section.type,
            name: section.name,
            visible: section.visible,
            content: (section.translations.find(
              (item) => item.locale === locale,
            )?.content ?? section.content) as Record<string, unknown>,
          }))}
          mediaUploadEndpoint={`/api/admin/pages/${page.id}/images`}
        />
      );
    });
  return (
    <div>
      <Link
        className="admin-back"
        href={fromStorefront ? "/admin/storefront" : "/admin/pages"}
      >
        ← {fromStorefront ? "Storefront" : "Pages"}
      </Link>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Content · {page.kind}</p>
          <h1>{page.name}</h1>
          <p>
            General contains identity and SEO; Sections contains all public page
            content without duplicated fields.
          </p>
        </div>
        <Link className="button secondary" href={publicHref} target="_blank">
          Preview
        </Link>
      </div>
      <nav className="admin-subnav" aria-label="Page editor sections">
        <a href="#general">General</a>
        <a href="#sections">Sections</a>
        <a href="#seo">SEO</a>
        {localizedEditors.length > 0 && (
          <a href="#translations">Translations</a>
        )}
        <a href={publicHref} target="_blank">
          Preview
        </a>
      </nav>
      <ContentPageEditor initial={initial} />
      <LandingSectionEditor
        initial={page.sections.map((section) => ({
          id: section.id,
          type: section.type,
          name: section.name,
          visible: section.visible,
          content: section.content as Record<string, unknown>,
        }))}
        endpoint={`/api/admin/pages/${page.id}/sections`}
        mediaUploadEndpoint={`/api/admin/pages/${page.id}/images`}
      />
      {localizedEditors.length > 0 && (
        <section className="admin-stack locale-stack" id="translations">
          <div className="panel-heading">
            <div>
              <h2>Translations</h2>
              <p>
                The default locale is {store.defaultLocale}. Missing fields fall
                back to it and are clearly marked.
              </p>
            </div>
          </div>
          {localizedEditors}
        </section>
      )}
    </div>
  );
}
