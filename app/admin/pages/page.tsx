import Link from "next/link";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

type ListedPage = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  status: string;
  categoryId: string | null;
  sectionCount: number;
  href: string;
  isDefault?: boolean;
};

function pageGroup(page: Pick<ListedPage, "kind" | "slug" | "categoryId">) {
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
  const listedPages: ListedPage[] = pages.map((page) => ({
    id: page.id,
    name: page.name,
    slug: page.slug,
    kind: page.kind,
    status: page.status,
    categoryId: page.categoryId,
    sectionCount: page._count.sections,
    href: page.categoryId
      ? `/admin/categories/${page.categoryId}#landing`
      : `/admin/pages/${page.id}`,
  }));
  const defaultLegalPages = [
    {
      slug: "terms",
      name: "Terms and conditions",
      type: "terms",
    },
    {
      slug: "privacy",
      name: "Privacy policy",
      type: "privacy",
    },
  ];
  for (const legalPage of defaultLegalPages) {
    if (listedPages.some((page) => page.slug === legalPage.slug)) continue;
    listedPages.push({
      id: `default-${legalPage.slug}`,
      name: legalPage.name,
      slug: legalPage.slug,
      kind: "LEGAL",
      status: "DEFAULT",
      categoryId: null,
      sectionCount: 0,
      href: `/admin/pages/new?type=${legalPage.type}`,
      isDefault: true,
    });
  }
  const groups = groupOrder
    .map((label) => ({
      label,
      pages: listedPages.filter((page) => pageGroup(page) === label),
    }))
    .filter((group) => group.pages.length > 0);
  const hasFaqPage = listedPages.some(
    (page) => !page.categoryId && page.slug === "faq",
  );

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
        <div className="actions">
          {!hasFaqPage && (
            <Link className="button secondary" href="/admin/pages/new?kind=faq">
              Set up FAQs
            </Link>
          )}
          <Link className="button" href="/admin/pages/new">
            Add page
          </Link>
        </div>
      </div>
      {groups.map((group) => (
        <section className="admin-panel" key={group.label}>
          <div className="panel-heading">
            <div>
              <h2>{group.label}</h2>
            </div>
          </div>
          <div className="admin-table category-admin-table page-admin-table mobile-cards">
            <div className="admin-tr admin-th">
              <span>Page</span>
              <span>Type</span>
              <span>Status</span>
              <span>Sections</span>
            </div>
            {group.pages.map((page) => (
              <Link
                className="admin-tr"
                href={page.href}
                key={page.id}
              >
                <span>
                  <strong>{page.name}</strong>
                  <small>/{page.slug}</small>
                </span>
                <span>{pageGroup(page)}</span>
                <span className={`admin-status ${page.status}`}>
                  {page.isDefault ? "DEFAULT" : page.status}
                </span>
                <span>
                  {page.isDefault ? "Create editable page" : page.sectionCount}
                </span>
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
