import { CategoryStatus, Prisma, ProductStatus, StoreStatus } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";

const publicCategoryArgs = Prisma.validator<Prisma.ProductCategoryDefaultArgs>()({
  include: {
    products: {
      where: { status: ProductStatus.ACTIVE, shopVisible: true },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { where: { active: true }, orderBy: { priceCents: "asc" } },
      },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
    },
  },
});

export type PublicCategory = Prisma.ProductCategoryGetPayload<typeof publicCategoryArgs>;

const getPublicCategoryForStore = cache((storeId: string, requestedSlug: string) => db.productCategory.findFirst({
  where: {
    storeId,
    status: CategoryStatus.PUBLISHED,
    showLanding: true,
    OR: [{ slug: requestedSlug }, { legacySlugs: { has: requestedSlug } }],
  },
  ...publicCategoryArgs,
}));

export async function getPublicCategory(requestedSlug: string) {
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE) return null;
  return getPublicCategoryForStore(store.id, requestedSlug);
}

export const categoryPublicPath = (slug: string) => `/${slug}`;
