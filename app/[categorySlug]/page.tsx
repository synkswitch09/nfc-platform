import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryLanding } from "@/components/category-landing";
import { categoryFaq } from "@/lib/category-content";
import { categoryPublicPath, getPublicCategory } from "@/lib/category-query";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront } from "@/lib/storefront";
import { hasStoreCapability } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";
import { LandingSectionRenderer } from "@/components/landing-section-renderer";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import { modularFaq, modularHeroImage } from "@/lib/landing-sections";
import { db } from "@/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }): Promise<Metadata> {
  const slug = (await params).categorySlug; const category = await getPublicCategory(slug);
  if (!category) {
    const store = await getCurrentStorefront(); const page = await db.contentPage.findFirst({ where: { storeId: store.id, slug, status: "PUBLISHED", categoryId: null, kind: { not: "HOME" } }, include: { sections: { where: { visible: true }, orderBy: { sortOrder: "asc" } } } });
    if (!page) return { robots: { index: false, follow: false } };
    const title = page.seoTitle ?? page.name; const description = page.seoDescription ?? undefined;
    return { title, description, alternates: { canonical: page.canonicalUrl ?? `/${page.slug}` }, robots: page.indexable && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false }, openGraph: { title, description, type: "website", images: page.ogImageUrl ? [page.ogImageUrl] : modularHeroImage(page.sections) ? [modularHeroImage(page.sections)!] : undefined } };
  }
  const title = category.seoTitle ?? category.heroHeadline ?? category.name;
  const description = category.seoDescription ?? category.shortDescription ?? category.description;
  return {
    title,
    description,
    alternates: { canonical: category.canonicalUrl ?? categoryPublicPath(category.slug) },
    robots: category.indexable && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description: description ?? undefined, type: "website", images: category.ogImageUrl ? [category.ogImageUrl] : modularHeroImage(category.landingSections) ? [modularHeroImage(category.landingSections)!] : category.heroImageUrl ? [category.heroImageUrl] : undefined },
  };
}

export default async function PublicCategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  const category = await getPublicCategory(categorySlug);
  if (!category) {
    const store = await getCurrentStorefront();
    const [page, categories, products] = await Promise.all([
      db.contentPage.findFirst({ where: { storeId: store.id, slug: categorySlug, status: "PUBLISHED", categoryId: null, kind: { not: "HOME" } }, include: { sections: { where: { visible: true }, orderBy: { sortOrder: "asc" } } } }),
      db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showLanding: true }, select: { id: true, slug: true, name: true, shortDescription: true, cardTitle: true, cardText: true, cardImageUrl: true, cardImageAlt: true, icon: true }, orderBy: { sortOrder: "asc" } }),
      db.product.findMany({ where: { storeId: store.id, status: "ACTIVE", shopVisible: true }, select: { id: true, slug: true, name: true, description: true, shortDescription: true, featured: true, images: { where: { isPrimary: true }, select: { url: true, altText: true }, take: 1 }, variants: { where: { active: true }, select: { priceCents: true }, orderBy: { priceCents: "asc" }, take: 1 } }, orderBy: [{ featured: "desc" }, { name: "asc" }] }),
    ]);
    if (!page) notFound();
    return <ModularPageRenderer name={page.name} sections={page.sections} products={products} categories={categories} store={{ displayName: store.displayName, currency: store.currency, nfcEnabled: hasStoreCapability(store, StoreCapability.NFC) }} breadcrumbs={[{ label: "Home", href: "/" }, { label: page.name }]} />;
  }
  if (categorySlug !== category.slug) permanentRedirect(categoryPublicPath(category.slug));

  const store = await getCurrentStorefront();
  const origin = store.origin;
  const faq = category.landingSections.length ? modularFaq(category.landingSections) : categoryFaq(category.faq);
  const products = category.showInShop ? category.products : [];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/shop` }, { "@type": "ListItem", position: 3, name: category.name, item: `${origin}${categoryPublicPath(category.slug)}` }] },
      { "@type": "CollectionPage", name: category.seoTitle ?? category.name, description: category.seoDescription ?? category.shortDescription, url: `${origin}${categoryPublicPath(category.slug)}`, mainEntity: { "@type": "ItemList", itemListElement: products.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: `${origin}/products/${product.slug}`, name: product.name })) } },
      ...(faq.length ? [{ "@type": "FAQPage", mainEntity: faq.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }] : []),
    ],
  };

  const storefront = { displayName: store.displayName, currency: store.currency, nfcEnabled: hasStoreCapability(store, StoreCapability.NFC) };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />{category.landingSections.length ? <LandingSectionRenderer category={category} store={storefront} /> : <CategoryLanding category={category} store={storefront} />}</>;
}
