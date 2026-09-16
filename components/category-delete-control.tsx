"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function CategoryDeleteControl({
  categoryId,
  categoryName,
  productCount,
  canDelete,
}: {
  categoryId: string;
  categoryName: string;
  productCount: number;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const hasProducts = productCount > 0;

  async function remove() {
    if (confirmation !== categoryName) return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/categories/${categoryId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(result.error ?? "Category could not be deleted");
      return;
    }
    router.push("/admin/categories");
    router.refresh();
  }

  if (!canDelete) return null;

  return (
    <section className="admin-panel" aria-labelledby="delete-category-heading">
      <div className="panel-heading">
        <div>
          <h2 id="delete-category-heading">Delete category</h2>
          <p>
            This permanently removes this category, its landing page and its
            category media. It cannot be undone.
          </p>
        </div>
      </div>
      {hasProducts ? (
        <p className="form-error" role="status">
          Move or unassign the {productCount} product
          {productCount === 1 ? "" : "s"} in this category before deleting it.
        </p>
      ) : !open ? (
        <button
          className="button danger"
          type="button"
          onClick={() => setOpen(true)}
        >
          <Trash2 size={16} /> Delete category
        </button>
      ) : (
        <div className="admin-subpanel">
          <p>
            Type <strong>{categoryName}</strong> exactly to permanently delete
            this category.
          </p>
          <label className="field">
            Category name confirmation
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="admin-form-actions">
            <button
              className="button danger"
              type="button"
              disabled={pending || confirmation !== categoryName}
              onClick={remove}
            >
              <Trash2 size={16} />{" "}
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setMessage("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="form-error" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
