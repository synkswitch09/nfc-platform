import { MediaLibrary } from "@/components/media-library";
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
      {media.length > 0 && <MediaLibrary initial={media} />}
      {!media.length && (
        <div className="admin-empty">
          No media has been uploaded for this Store yet.
        </div>
      )}
    </div>
  );
}
