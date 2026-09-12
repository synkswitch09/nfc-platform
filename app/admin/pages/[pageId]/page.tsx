import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPageEditor, type ContentPageEditorInitial } from "@/components/content-page-editor";
import { LandingSectionEditor } from "@/components/landing-section-editor";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function EditContentPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params; const { store } = await requireAdminPageContext();
  const page = await db.contentPage.findFirst({ where: { id: pageId, storeId: store.id, categoryId: null }, include: { sections: { orderBy: { sortOrder: "asc" } } } }); if (!page) notFound();
  const initial: ContentPageEditorInitial = { id: page.id, name: page.name, slug: page.slug, kind: page.kind as ContentPageEditorInitial["kind"], status: page.status, sortOrder: page.sortOrder, seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", ogImageUrl: page.ogImageUrl ?? "", canonicalUrl: page.canonicalUrl ?? "", indexable: page.indexable };
  const publicHref = page.kind === "HOME" ? "/" : `/${page.slug}`;
  return <div><Link className="admin-back" href="/admin/pages">← Pages</Link><div className="admin-heading"><div><p className="admin-kicker">Content · {page.kind}</p><h1>{page.name}</h1><p>General contains identity and SEO; Sections contains all public page content without duplicated fields.</p></div><Link className="button secondary" href={publicHref} target="_blank">Preview</Link></div><ContentPageEditor initial={initial} /><LandingSectionEditor initial={page.sections.map(section => ({ id: section.id, type: section.type, name: section.name, visible: section.visible, content: section.content as Record<string, unknown> }))} endpoint={`/api/admin/pages/${page.id}/sections`} mediaUploadEndpoint={`/api/admin/pages/${page.id}/images`} /></div>;
}
