import Link from "next/link";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function AdminPagesPage() {
  const { store } = await requireAdminPageContext();
  const pages = await db.contentPage.findMany({ where: { storeId: store.id }, include: { _count: { select: { sections: true } } }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Content</p><h1>Pages</h1><p>Home, category, campaign, collection and legal pages share one structured section engine.</p></div><Link className="button" href="/admin/pages/new">Add page</Link></div><section className="admin-panel"><div className="admin-table category-admin-table"><div className="admin-tr admin-th"><span>Page</span><span>Type</span><span>Status</span><span>Sections</span></div>{pages.map(page => <Link className="admin-tr" href={page.categoryId ? `/admin/categories/${page.categoryId}` : `/admin/pages/${page.id}`} key={page.id}><span><strong>{page.name}</strong><small>/{page.kind === "HOME" ? "" : page.slug}</small></span><span>{page.kind}</span><span className={`admin-status ${page.status}`}>{page.status}</span><span>{page._count.sections}</span></Link>)}</div>{!pages.length && <div className="admin-empty">No modular pages have been created yet.</div>}</section></div>;
}
