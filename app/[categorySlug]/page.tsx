import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryLanding } from "@/components/category-landing";
import { categoryFaq } from "@/lib/category-content";
import { categoryPublicPath, getPublicCategory } from "@/lib/category-query";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront } from "@/lib/storefront";

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }): Promise<Metadata> {
  const category = await getPublicCategory((await params).categorySlug);
  if (!category) return { robots: { index: false, follow: false } };
  const title = category.seoTitle ?? category.heroHeadline ?? category.name;
  const description = category.seoDescription ?? category.shortDescription ?? category.description;
  return {
    title,
    description,
    alternates: { canonical: category.canonicalUrl ?? categoryPublicPath(category.slug) },
    robots: category.indexable && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description: description ?? undefined, type: "website", images: category.ogImageUrl ? [category.ogImageUrl] : category.heroImageUrl ? [category.heroImageUrl] : undefined },
  };
}

export default async function PublicCategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  const category = await getPublicCategory(categorySlug);
  if (!category) notFound();
  if (categorySlug !== category.slug) permanentRedirect(categoryPublicPath(category.slug));

  const origin = (await getCurrentStorefront()).origin;
  const faq = categoryFaq(category.faq);
  const products = category.showInShop ? category.products : [];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/shop` }, { "@type": "ListItem", position: 3, name: category.name, item: `${origin}${categoryPublicPath(category.slug)}` }] },
      { "@type": "CollectionPage", name: category.seoTitle ?? category.name, description: category.seoDescription ?? category.shortDescription, url: `${origin}${categoryPublicPath(category.slug)}`, mainEntity: { "@type": "ItemList", itemListElement: products.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: `${origin}/products/${product.slug}`, name: product.name })) } },
      ...(faq.length ? [{ "@type": "FAQPage", mainEntity: faq.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }] : []),
    ],
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} /><CategoryLanding category={category} /></>;
}
