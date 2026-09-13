import Image from "next/image";
import Link from "next/link";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function AdminMediaPage() {
  const { store } = await requireAdminPageContext();
  const media = await db.categoryImage.findMany({
    where: { storeId: store.id },
    include: {
      category: { select: { id: true, name: true } },
      page: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Content</p>
          <h1>Media</h1>
          <p>
            Images uploaded for this Store, with their page or category owner.
          </p>
        </div>
      </div>
      <section className="admin-media-grid">
        {media.map((item) => {
          const href = item.category
            ? `/admin/categories/${item.category.id}#landing`
            : item.page
              ? `/admin/pages/${item.page.id}`
              : "/admin/settings";
          return (
            <Link className="admin-media-card" href={href} key={item.id}>
              <Image
                src={item.url}
                alt={item.altText ?? ""}
                width={320}
                height={200}
                unoptimized
              />
              <strong>
                {item.category?.name ?? item.page?.name ?? "Store media"}
              </strong>
              <small>{item.purpose.replaceAll("-", " ")}</small>
            </Link>
          );
        })}
      </section>
      {!media.length && (
        <div className="admin-empty">
          No media has been uploaded for this Store yet.
        </div>
      )}
    </div>
  );
}
