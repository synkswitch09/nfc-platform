import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";

const publicCategoryArgs = Prisma.validator<Prisma.ProductCategoryDefaultArgs>()({
  include: {
    products: {
      where: { status: "ACTIVE", shopVisible: true },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { where: { active: true }, orderBy: { priceCents: "asc" } },
      },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
    },
  },
});

export type PublicCategory = Prisma.ProductCategoryGetPayload<typeof publicCategoryArgs>;

export const getPublicCategory = cache((requestedSlug: string) => db.productCategory.findFirst({
  where: {
    status: "PUBLISHED",
    showLanding: true,
    OR: [{ slug: requestedSlug }, { legacySlugs: { has: requestedSlug } }],
  },
  ...publicCategoryArgs,
}));

export const categoryPublicPath = (slug: string) => `/${slug}`;
