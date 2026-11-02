import Link from "next/link";

export function CustomerReviewCard({ productName, productHref, rating, body, author, supportingText }: {
  productName?: string; productHref?: string; rating?: number; body?: string; author?: string; supportingText?: string;
}) {
  const score = typeof rating === "number" && Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null;
  return <figure className="kosy-review-card">
    {productName && <div className="kosy-review-product">{productHref ? <Link href={productHref}>{productName}</Link> : productName}</div>}
    {score !== null && <div className="kosy-review-rating" aria-label={`${score} out of 5 stars`}>
      <span className="kosy-review-stars" aria-hidden="true">{"★".repeat(Math.floor(score))}{"☆".repeat(5 - Math.floor(score))}</span>
      <span aria-hidden="true" className="kosy-review-score">{score.toFixed(1)}</span>
    </div>}
    <blockquote>“{body}”</blockquote>
    <figcaption><strong>{author}</strong>{supportingText && <span>{supportingText}</span>}</figcaption>
  </figure>;
}
