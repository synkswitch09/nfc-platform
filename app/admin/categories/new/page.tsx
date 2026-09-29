import { CategoryEditor, type CategoryEditorInitial } from "@/components/category-editor";
import { requireAdminPageContext } from "@/lib/admin";
import { hasStoreCapability } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";

export default async function NewCategoryPage() {
  const { store } = await requireAdminPageContext();
  const nfcEnabled = hasStoreCapability(store, StoreCapability.NFC);
  const initial: CategoryEditorInitial = { name: "", slug: "", shortDescription: "", description: "", icon: nfcEnabled ? "radio" : "shapes", imageUrl: "", cardTitle: "", cardText: "", cardImageUrl: "", cardImageAlt: "", heroEyebrow: "Products for real life", heroHeadline: "", heroDescription: "", heroImageUrl: "", heroImageAlt: "", secondaryImageUrl: "", ctaLabel: "Shop this collection", ctaHref: "/shop", secondaryCtaLabel: "", secondaryCtaHref: "", finalCtaEyebrow: "Made for real life", finalCtaHeadline: nfcEnabled ? "Ready to make every tap useful?" : "Ready to make the everyday more useful?", finalCtaDescription: `Choose a ${store.displayName} product and configure it around what matters to you.`, finalCtaLabel: "Shop this collection", finalCtaHref: "/shop", visualTheme: "CORAL", landingLayout: "EDITORIAL", status: "DRAFT", sortOrder: 0, showOnHomepage: true, showInNavigation: true, showInShop: true, showLanding: true, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false, benefits: [], useCases: [], howItWorks: [], contentSections: [], faq: [] };
  return <div><div className="admin-heading"><div><p className="admin-kicker">Content · {store.displayName}</p><h1>New category</h1><p>Create the category settings first. After saving, add its public content in the landing page builder.</p></div></div><CategoryEditor initial={initial} /></div>;
}
