import Link from "next/link";
import {
  ContentPageEditor,
  type ContentPageEditorInitial,
} from "@/components/content-page-editor";
import { requireAdminPageContext } from "@/lib/admin";

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await requireAdminPageContext();
  const requestedKind = (await searchParams).kind;
  const isFaqPage = requestedKind === "faq";
  const kind: ContentPageEditorInitial["kind"] =
    requestedKind === "HOME"
      ? "HOME"
      : isFaqPage
        ? "COLLECTION"
        : "CAMPAIGN";
  const initial: ContentPageEditorInitial = {
    name: kind === "HOME" ? "Home" : isFaqPage ? "Frequently asked questions" : "",
    slug: kind === "HOME" ? "home" : isFaqPage ? "faq" : "",
    kind,
    status: isFaqPage ? "PUBLISHED" : "DRAFT",
    sortOrder: 0,
    visualTheme: "CORAL",
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    canonicalUrl: "",
    indexable: isFaqPage,
  };
  return (
    <div>
      <Link className="admin-back" href="/admin/pages">
        ← Pages
      </Link>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Content</p>
          <h1>New page</h1>
          <p>Create the page shell first, then add structured sections.</p>
        </div>
      </div>
      <ContentPageEditor initial={initial} />
    </div>
  );
}
