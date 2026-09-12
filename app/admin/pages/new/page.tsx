import Link from "next/link";
import { ContentPageEditor, type ContentPageEditorInitial } from "@/components/content-page-editor";
import { requireAdminPageContext } from "@/lib/admin";

export default async function NewContentPage() {
  await requireAdminPageContext();
  const initial: ContentPageEditorInitial = { name: "", slug: "", kind: "CAMPAIGN", status: "DRAFT", sortOrder: 0, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false };
  return <div><Link className="admin-back" href="/admin/pages">← Pages</Link><div className="admin-heading"><div><p className="admin-kicker">Content</p><h1>New page</h1><p>Create the page shell first, then add structured sections.</p></div></div><ContentPageEditor initial={initial} /></div>;
}
