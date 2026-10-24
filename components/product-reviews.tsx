import Link from "next/link";
import { db } from "@/lib/db";
import { supportIdentity, supportOrderOwner } from "@/lib/support-access";
import { paidReviewOrder } from "@/lib/product-reviews";
import { getExperience } from "@/lib/store-experience";
import type { Storefront } from "@/lib/storefront";
import { ProductReviewForm } from "@/components/product-review-form";
export async function ProductReviews({
  store,
  productId,
}: {
  store: Storefront;
  productId: string;
}) {
  if (!(await getExperience(store.id)).config.reviewsEnabled) return null;
  const [reviews, identity] = await Promise.all([
    db.productReview.findMany({
      where: { storeId: store.id, productId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, displayName: true, rating: true, body: true },
    }),
    supportIdentity(store),
  ]);
  const item = identity
    ? await db.orderItem.findFirst({
        where: {
          variant: { productId, product: { storeId: store.id } },
          review: null,
          order: {
            storeId: store.id,
            AND: [paidReviewOrder, supportOrderOwner(identity)],
            reviews: { none: { productId } },
          },
        },
        orderBy: { order: { createdAt: "desc" } },
        select: { id: true },
      })
    : null;
  return (
    <section className="section product-reviews" id="reviews">
      <h2>Customer reviews</h2>
      {reviews.length ? (
        <div className="kosy-review-grid">
          {reviews.map((review) => (
            <figure key={review.id}>
              <p aria-label={`${review.rating} out of 5 stars`}>
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </p>
              <blockquote>{review.body}</blockquote>
              <figcaption>
                <strong>{review.displayName}</strong>
                <span>Verified purchase</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p>No customer reviews yet.</p>
      )}
      {item ? (
        <ProductReviewForm productId={productId} orderItemId={item.id} />
      ) : (
        <p>
          Purchased this product?{" "}
          <Link href="/support">
            Verify your purchase email through Help & requests
          </Link>{" "}
          or <Link href="/login">sign in</Link> to leave a review. One review
          per product per order.
        </p>
      )}
    </section>
  );
}
