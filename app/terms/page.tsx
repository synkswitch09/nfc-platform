import { StoreCapability } from "@prisma/client";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import { db } from "@/lib/db";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";

export default async function TermsPage() { const store = await getCurrentStorefront(); const page = process.env.DATABASE_URL ? await db.contentPage.findFirst({ where: { storeId: store.id, kind: "LEGAL", slug: "terms", status: "PUBLISHED" }, include: { sections: { where: { visible: true }, orderBy: { sortOrder: "asc" } } } }).catch(() => null) : null; if (page?.sections.length) return <ModularPageRenderer name={page.name} sections={page.sections} products={[]} categories={[]} store={{ displayName: store.displayName, currency: store.currency, nfcEnabled: hasStoreCapability(store, StoreCapability.NFC) }} breadcrumbs={[{ label: "Home", href: "/" }, { label: page.name }]} />; return <article className="section article-page"><h1>Terms of service</h1><p className="lead"><strong>LEGAL REVIEW REQUIRED BEFORE PRODUCTION.</strong> This placeholder must be reviewed by an Australian legal professional before accepting live orders.</p></article>; }
