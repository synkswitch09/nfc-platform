import Link from "next/link";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

function pageGroup(page: {
  kind: string;
  slug: string;
  categoryId: string | null;
}) {
  if (page.categoryId) return "Category landings";
  if (page.slug === "faq") return "FAQ";
  if (page.kind === "LEGAL") return "Legal";
  if (page.kind === "CAMPAIGN") return "Campaigns";
  return "Standard pages";
}

const groupOrder = [
  "FAQ",
  "Standard pages",
  "Campaigns",
  "Legal",
  "Category landings",
];

export default async function AdminPagesPage() {
  const { store } = await requireAdminPageContext();
  const pages = await db.contentPage.findMany({
    where: { storeId: store.id, kind: { not: "HOME" } },
    include: { _count: { select: { sections: true } } },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const groups = groupOrder
    .map((label) => ({
      label,
      pages: pages.filter((page) => pageGroup(page) === label),
    }))
    .filter((group) => group.pages.length > 0);

  return (
    <div>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Content</p>
          <h1>Pages</h1>
          <p>
            FAQ, standard, campaign, legal and category landing pages use the
            same structured section engine. Home lives under Storefront.
          </p>
        </div>
        <Link className="button" href="/admin/pages/new">
          Add page
        </Link>
      </div>
      {groups.map((group) => (
        <section className="admin-panel" key={group.label}>
          <div className="panel-heading">
            <div>
              <h2>{group.label}</h2>
            </div>
          </div>
          <div className="admin-table category-admin-table">
            <div className="admin-tr admin-th">
              <span>Page</span>
              <span>Type</span>
              <span>Status</span>
              <span>Sections</span>
            </div>
            {group.pages.map((page) => (
              <Link
                className="admin-tr"
                href={
                  page.categoryId
                    ? `/admin/categories/${page.categoryId}#landing`
                    : `/admin/pages/${page.id}`
                }
                key={page.id}
              >
                <span>
                  <strong>{page.name}</strong>
                  <small>/{page.slug}</small>
                </span>
                <span>{pageGroup(page)}</span>
                <span className={`admin-status ${page.status}`}>
                  {page.status}
                </span>
                <span>{page._count.sections}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {!pages.length && (
        <div className="admin-empty">
          No modular pages have been created yet.
        </div>
      )}
    </div>
  );
}
