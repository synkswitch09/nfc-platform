import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStorefront } from "@/lib/storefront";
import { supportIdentity, supportOrderOwner } from "@/lib/support-access";
import { db } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { paidReviewOrder, reviewSchema } from "@/lib/product-reviews";
import { getExperience } from "@/lib/store-experience";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  if (!assertSameOrigin(request))
    return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront();
  if (!(await getExperience(store.id)).config.reviewsEnabled)
    return jsonError("Reviews are currently paused", 409);
  const identity = await supportIdentity(store);
  if (!identity)
    return jsonError(
      "Sign in or verify your purchase email through Help & requests",
      401,
    );
  if (
    !(
      await rateLimit(
        "product-review",
        `${store.id}:${identity.email}:${getClientIp(request)}`,
        5,
        3600000,
      )
    ).allowed
  )
    return jsonError("Please try again later", 429);
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return jsonError(
      "Enter a name, a rating from 1 to 5 and a review of 10–2000 characters",
      400,
    );
  const { productId } = await params;
  if (!z.string().uuid().safeParse(productId).success)
    return jsonError("Product not found", 404);
  const item = await db.orderItem.findFirst({
    where: {
      id: parsed.data.orderItemId,
      variant: { productId, product: { storeId: store.id } },
      order: {
        storeId: store.id,
        AND: [paidReviewOrder, supportOrderOwner(identity)],
      },
    },
  });
  if (!item)
    return jsonError(
      "A verified paid purchase of this product is required",
      403,
    );
  try {
    await db.productReview.create({
      data: {
        ...parsed.data,
        productId,
        storeId: store.id,
        orderId: item.orderId,
        status: "PENDING",
      },
    });
    return NextResponse.json(
      {
        ok: true,
        message: "Thank you. Your review has been submitted for moderation.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      return jsonError("You already reviewed this product in this order", 409);
    throw error;
  }
}
