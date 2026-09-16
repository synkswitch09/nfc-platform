import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryEditor,
  type CategoryEditorInitial,
} from "@/components/category-editor";
import {
  allCategoryBenefits,
  allCategoryFaq,
  allCategorySections,
  allCategorySteps,
  allCategoryUseCases,
} from "@/lib/category-content";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";
import { LandingSectionEditor } from "@/components/landing-section-editor";
import { PageTranslationEditor } from "@/components/page-translation-editor";
import { CategoryDeleteControl } from "@/components/category-delete-control";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const { store, user } = await requireAdminPageContext();
  const category = await db.productCategory.findFirst({
    where: { id: categoryId, storeId: store.id },
    include: {
      contentPage: { include: { translations: true } },
      products: {
        where: { storeId: store.id },
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      },
      landingSections: {
        include: { translations: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!category) notFound();
  const initial: CategoryEditorInitial = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    shortDescription: category.shortDescription ?? "",
    description: category.description ?? "",
    icon: category.icon ?? "",
    imageUrl: category.imageUrl ?? "",
    cardTitle: category.cardTitle ?? "",
    cardText: category.cardText ?? "",
    cardImageUrl: category.cardImageUrl ?? "",
    cardImageAlt: category.cardImageAlt ?? "",
    heroEyebrow: category.heroEyebrow ?? "",
    heroHeadline: category.heroHeadline ?? "",
    heroDescription: category.heroDescription ?? "",
    heroImageUrl: category.heroImageUrl ?? "",
    heroImageAlt: category.heroImageAlt ?? "",
    secondaryImageUrl: category.secondaryImageUrl ?? "",
    ctaLabel: category.ctaLabel ?? "",
    ctaHref: category.ctaHref ?? "",
    secondaryCtaLabel: category.secondaryCtaLabel ?? "",
    secondaryCtaHref: category.secondaryCtaHref ?? "",
    finalCtaEyebrow: category.finalCtaEyebrow ?? "",
    finalCtaHeadline: category.finalCtaHeadline ?? "",
    finalCtaDescription: category.finalCtaDescription ?? "",
    finalCtaLabel: category.finalCtaLabel ?? "",
    finalCtaHref: category.finalCtaHref ?? "",
    visualTheme: category.visualTheme,
    landingLayout: category.landingLayout,
    status: category.status,
    sortOrder: category.sortOrder,
    showOnHomepage: category.showOnHomepage,
    showInNavigation: category.showInNavigation,
    showInShop: category.showInShop,
    showLanding: category.showLanding,
    seoTitle: category.seoTitle ?? "",
    seoDescription: category.seoDescription ?? "",
    ogImageUrl: category.ogImageUrl ?? "",
    canonicalUrl: category.canonicalUrl ?? "",
    indexable: category.indexable,
    benefits: allCategoryBenefits(category.benefits),
    useCases: allCategoryUseCases(category.useCases),
    howItWorks: allCategorySteps(category.howItWorks),
    contentSections: allCategorySections(category.contentSections),
    faq: allCategoryFaq(category.faq),
  };
  return (
    <div>
      <Link className="admin-back" href="/admin/categories">
        ← Categories
      </Link>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Catalog · Categories</p>
          <h1>{category.name}</h1>
          <p>Commercial visibility is independent from every existing tag.</p>
        </div>
        <span className={`admin-status large ${category.status}`}>
          {category.status}
        </span>
      </div>
      <nav className="admin-subnav" aria-label="Category editor sections">
        <a href="#general">General</a>
        <a href="#appearance">Appearance</a>
        <a href="#products">Products</a>
        <a href="#landing">Landing</a>
        <a href="#seo">SEO</a>
        <a href="#visibility">Visibility</a>
        <a href={`/${category.slug}`} target="_blank">
          Preview
        </a>
      </nav>
      <CategoryEditor initial={initial} />
      <section className="admin-panel" id="products">
        <div className="panel-heading">
          <div>
            <h2>Products in this category</h2>
            <p>Assign or move products from each product editor.</p>
          </div>
          <Link href="/admin/products/new" className="button secondary">
            Add product
          </Link>
        </div>
        <div className="compact-list">
          {category.products.map((product) => (
            <Link href={`/admin/products/${product.id}`} key={product.id}>
              <strong>{product.name}</strong>
              <span className={`admin-status ${product.status}`}>
                {product.status}
              </span>
            </Link>
          ))}
        </div>
        {!category.products.length && (
          <div className="admin-empty">No products assigned yet.</div>
        )}
      </section>
      <LandingSectionEditor
        anchorId="landing"
        categoryId={category.id}
        initial={category.landingSections.map((section) => ({
          id: section.id,
          type: section.type,
          name: section.name,
          visible: section.visible,
          content: section.content as Record<string, unknown>,
        }))}
      />
      <CategoryDeleteControl
        categoryId={category.id}
        categoryName={category.name}
        productCount={category.products.length}
        canDelete={user.role === "ADMIN"}
      />
      {category.contentPage &&
        store.enabledLocales.filter((locale) => locale !== store.defaultLocale)
          .length > 0 && (
          <section className="admin-stack locale-stack">
            <div className="panel-heading">
              <div>
                <h2>Landing translations</h2>
                <p>
                  The default locale is {store.defaultLocale}. Missing fields
                  fall back to it.
                </p>
              </div>
            </div>
            {store.enabledLocales
              .filter((locale) => locale !== store.defaultLocale)
              .map((locale) => {
                const translation = category.contentPage!.translations.find(
                  (item) => item.locale === locale,
                );
                return (
                  <PageTranslationEditor
                    key={locale}
                    pageId={category.contentPage!.id}
                    locale={locale}
                    localeName={
                      new Intl.DisplayNames([store.defaultLocale], {
                        type: "language",
                      }).of(locale) ?? locale
                    }
                    missing={
                      !translation ||
                      category.landingSections.some(
                        (section) =>
                          !section.translations.some(
                            (item) => item.locale === locale,
                          ),
                      )
                    }
                    metadata={{
                      name: translation?.name ?? category.name,
                      seoTitle:
                        translation?.seoTitle ?? category.seoTitle ?? "",
                      seoDescription:
                        translation?.seoDescription ??
                        category.seoDescription ??
                        "",
                    }}
                    sections={category.landingSections.map((section) => ({
                      id: section.id,
                      type: section.type,
                      name: section.name,
                      visible: section.visible,
                      content: (section.translations.find(
                        (item) => item.locale === locale,
                      )?.content ?? section.content) as Record<string, unknown>,
                    }))}
                    mediaUploadEndpoint={`/api/admin/categories/${category.id}/images`}
                  />
                );
              })}
          </section>
        )}
    </div>
  );
}
