import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function AdminStorefrontHomePage() {
  const { store } = await requireAdminPageContext();
  const home = await db.contentPage.findFirst({
    where: { storeId: store.id, kind: "HOME", categoryId: null },
    select: { id: true },
  });
  if (home) redirect(`/admin/pages/${home.id}?from=storefront`);
  return (
    <div>
      <Link className="admin-back" href="/admin/storefront">
        ← Storefront
      </Link>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Content · Storefront</p>
          <h1>Home</h1>
          <p>This Store does not have a modular Home page yet.</p>
        </div>
        <Link className="button" href="/admin/pages/new?kind=HOME">
          Create Home
        </Link>
      </div>
    </div>
  );
}
