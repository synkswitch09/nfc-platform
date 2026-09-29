"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type MediaLibraryItem = {
  id: string;
  url: string;
  altText: string | null;
  purpose: string;
  category: { id: string; name: string } | null;
  page: { id: string; name: string } | null;
};

export function MediaLibrary({ initial }: { initial: MediaLibraryItem[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function remove(item: MediaLibraryItem) {
    if (
      !window.confirm(
        "Delete this image? It will also be removed from every page, section, logo, social icon or SEO field that currently uses it.",
      )
    )
      return;
    setDeletingId(item.id);
    setMessage("");
    const response = await fetch(`/api/admin/media/${item.id}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    setDeletingId(null);
    if (!response.ok) {
      setMessage(result.error ?? "Image could not be deleted");
      return;
    }
    setMessage("Image deleted and its references were cleared.");
    router.refresh();
  }

  return (
    <>
      {message && <p className="notice" role="status">{message}</p>}
      <section className="admin-media-grid">
        {initial.map((item) => {
          const href = item.category
            ? `/admin/categories/${item.category.id}#landing`
            : item.page
              ? `/admin/pages/${item.page.id}`
              : "/admin/settings";
          return (
            <article className="admin-media-card" key={item.id}>
              <Link href={href}>
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
              <button
                className="button secondary danger"
                type="button"
                disabled={deletingId === item.id}
                onClick={() => remove(item)}
              >
                <Trash2 size={15} />
                {deletingId === item.id ? "Deleting…" : "Delete image"}
              </button>
            </article>
          );
        })}
      </section>
    </>
  );
}
