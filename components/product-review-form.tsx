"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function ProductReviewForm({
  productId,
  orderItemId,
}: {
  productId: string;
  orderItemId: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderItemId,
          displayName: form.get("displayName"),
          rating: Number(form.get("rating")),
          body: form.get("body"),
        }),
      });
      const result = await response.json();
      setMessage(response.ok ? result.message : result.error);
      if (response.ok) {
        setSubmitted(true);
        router.refresh();
      }
    } catch {
      setMessage("Could not submit your review. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {!submitted && (
        <form onSubmit={submit} className="review-form">
          <h3>Review your purchase</h3>
          <label className="field">
            Public display name
            <input
              name="displayName"
              required
              maxLength={60}
              autoComplete="nickname"
            />
          </label>
          <label className="field">
            Rating
            <select name="rating" defaultValue="5">
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} / 5
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Your experience
            <textarea
              name="body"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
            />
          </label>
          <p>
            Your display name, rating and review will be public once approved.
            Please leave out personal information.
          </p>
          <button className="button" disabled={busy}>
            {busy ? "Submitting…" : "Submit review"}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
