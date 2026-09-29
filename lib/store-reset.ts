import { z } from "zod";
import { db } from "@/lib/db";

// Fail closed: a destructive reset must explicitly target a non-production environment.
export function isStoreResetAllowed(environment: Record<string, string | undefined> = process.env) {
  return environment.APP_ENV === "development" || environment.APP_ENV === "staging";
}

export function assertStoreResetAllowed(environment: Record<string, string | undefined> = process.env) {
  if (!isStoreResetAllowed(environment)) {
    throw new Error("STORE_RESET_DISABLED");
  }
}

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(160);

export const storeResetSchema = z.object({
  confirmation: z.string().trim().min(1).max(100),
  productName: z.string().trim().min(2).max(140),
  productSlug: slug,
  productSku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{2,49}$/),
  productDescription: z.string().trim().min(10).max(500),
  priceCents: z.number().int().min(0).max(100_000_000),
});

export type StoreResetInput = z.infer<typeof storeResetSchema>;

export type StoreResetPreview = {
  categories: number;
  products: number;
  variants: number;
  carts: number;
  orders: number;
  tags: number;
  batches: number;
  manufacturingJobs: number;
  shipments: number;
  printJobs: number;
  inventoryMovements: number;
  auditLogs: number;
};

export async function getStoreResetPreview(
  storeId: string,
): Promise<StoreResetPreview> {
  const [
    categories,
    products,
    variants,
    carts,
    orders,
    tags,
    batches,
    manufacturingJobs,
    shipments,
    printJobs,
    inventoryMovements,
    auditLogs,
  ] = await Promise.all([
    db.productCategory.count({ where: { storeId } }),
    db.product.count({ where: { storeId } }),
    db.productVariant.count({ where: { product: { storeId } } }),
    db.cart.count({ where: { storeId } }),
    db.order.count({ where: { storeId } }),
    db.nFCTag.count({ where: { storeId } }),
    db.manufacturingBatch.count({ where: { storeId } }),
    db.manufacturingJob.count({ where: { storeId } }),
    db.shipment.count({ where: { storeId } }),
    db.printJob.count({ where: { storeId } }),
    db.inventoryMovement.count({ where: { variant: { product: { storeId } } } }),
    db.auditLog.count({ where: { storeId } }),
  ]);
  return {
    categories,
    products,
    variants,
    carts,
    orders,
    tags,
    batches,
    manufacturingJobs,
    shipments,
    printJobs,
    inventoryMovements,
    auditLogs,
  };
}

export async function resetStoreToPetsBaseline({
  storeId,
  actorId,
  input,
}: {
  storeId: string;
  actorId: string;
  input: StoreResetInput;
}) {
  assertStoreResetAllowed();
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { id: true, displayName: true, defaultLocale: true },
  });
  if (!store) throw new Error("STORE_NOT_FOUND");
  if (input.confirmation !== store.displayName)
    throw new Error("INVALID_CONFIRMATION");

  const [productImages, categoryImages, shipmentLabels, products, categories] =
    await Promise.all([
      db.productImage.findMany({
        where: { product: { storeId } },
        select: { storageKey: true },
      }),
      db.categoryImage.findMany({
        where: { storeId, categoryId: { not: null } },
        select: { storageKey: true },
      }),
      db.shipment.findMany({
        where: { storeId, labelStorageKey: { not: null } },
        select: { labelStorageKey: true },
      }),
      db.product.findMany({ where: { storeId }, select: { id: true } }),
      db.productCategory.findMany({ where: { storeId }, select: { id: true } }),
    ]);
  const productIds = products.map((product) => product.id);
  const categoryIds = categories.map((category) => category.id);
  const storageKeys = [
    ...productImages.map((image) => image.storageKey),
    ...categoryImages.map((image) => image.storageKey),
    ...shipmentLabels.flatMap((shipment) =>
      shipment.labelStorageKey ? [shipment.labelStorageKey] : [],
    ),
  ];

  const result = await db.$transaction(async (tx) => {
    const customers = await tx.storeMembership.findMany({
      where: { storeId, role: "CUSTOMER" },
      select: { userId: true },
    });
    const customerIds = customers.map((customer) => customer.userId);

    // Dependent operational data must be removed before its products and orders.
    await tx.printJob.deleteMany({ where: { storeId } });
    await tx.shipment.deleteMany({ where: { storeId } });
    await tx.payment.deleteMany({ where: { order: { storeId } } });
    await tx.manufacturingJob.deleteMany({ where: { storeId } });
    await tx.nFCTag.deleteMany({ where: { storeId } });
    await tx.manufacturingBatch.deleteMany({ where: { storeId } });
    await tx.inventoryMovement.deleteMany({
      where: { variant: { product: { storeId } } },
    });
    await tx.cartItem.deleteMany({ where: { cart: { storeId } } });
    await tx.cart.deleteMany({ where: { storeId } });
    await tx.order.deleteMany({ where: { storeId } });
    await tx.shippingQuote.deleteMany({ where: { storeId } });

    if (customerIds.length) {
      await tx.session.deleteMany({
        where: { storeId, userId: { in: customerIds } },
      });
      await tx.storeMembership.deleteMany({
        where: { storeId, role: "CUSTOMER" },
      });
    }
    await tx.emailVerification.deleteMany({ where: { storeId } });
    await tx.passwordReset.deleteMany({ where: { storeId } });

    if (categoryIds.length) {
      await tx.contentPage.deleteMany({
        where: { storeId, categoryId: { in: categoryIds } },
      });
    }
    if (productIds.length) {
      await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } });
      await tx.product.deleteMany({ where: { id: { in: productIds } } });
    }
    await tx.productCategory.deleteMany({ where: { storeId } });
    await tx.auditLog.deleteMany({ where: { storeId } });

    const category = await tx.productCategory.create({
      data: {
        storeId,
        slug: "pets",
        name: "Pets",
        shortDescription: "Personalised NFC pet tags made for everyday adventures.",
        status: "PUBLISHED",
        sortOrder: 0,
        showOnHomepage: true,
        showInNavigation: true,
        showInShop: true,
        showLanding: true,
        indexable: true,
      },
    });
    const page = await tx.contentPage.create({
      data: {
        storeId,
        categoryId: category.id,
        kind: "CATEGORY",
        slug: category.slug,
        name: category.name,
        status: "PUBLISHED",
        sortOrder: 0,
        defaultLocale: store.defaultLocale,
      },
    });
    const product = await tx.product.create({
      data: {
        storeId,
        categoryId: category.id,
        slug: input.productSlug,
        name: input.productName,
        description: input.productDescription,
        shortDescription: input.productDescription,
        type: "PET",
        status: "ACTIVE",
        featured: true,
        shopVisible: true,
        brand: store.displayName,
        personalisationMode: "NONE",
        variants: {
          create: {
            sku: input.productSku,
            name: "Standard",
            priceCents: input.priceCents,
            inventory: 0,
            reservedInventory: 0,
            trackInventory: true,
            backorderPolicy: "DENY",
            active: true,
            isDefault: true,
          },
        },
      },
      include: { variants: { select: { id: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        storeId,
        action: "STORE_RESET_TO_PETS_BASELINE",
        entityType: "Store",
        entityId: storeId,
        metadata: {
          categoryId: category.id,
          pageId: page.id,
          productId: product.id,
          productVariantId: product.variants[0]?.id,
          retained: ["store settings", "CMS pages", "shipping configuration", "print agents", "staff access"],
        },
      },
    });
    return { category, product };
  });

  return { ...result, storageKeys: [...new Set(storageKeys)] };
}
