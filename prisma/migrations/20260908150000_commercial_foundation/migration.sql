-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CustomisationFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SELECT', 'RADIO', 'CHECKBOX', 'COLOUR', 'IMAGE');

-- CreateEnum
CREATE TYPE "BackorderPolicy" AS ENUM ('DENY', 'ALLOW');

-- CreateEnum
CREATE TYPE "ManufacturingStatus" AS ENUM ('GENERATED', 'PROGRAMMED', 'VERIFIED', 'ASSEMBLED', 'READY', 'ASSIGNED', 'SOLD');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'RESERVATION', 'RELEASE', 'SALE', 'RETURN', 'ADJUSTMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductType" ADD VALUE 'EMERGENCY';
ALTER TYPE "ProductType" ADD VALUE 'REVIEW';
ALTER TYPE "ProductType" ADD VALUE 'CUSTOM';
ALTER TYPE "ProductType" ADD VALUE 'ACCESSORY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'READY_TO_SHIP';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Add the replacement publication state before removing the legacy flag.
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT NOT NULL DEFAULT 'TapKind',
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "categoryId" UUID,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "gstInclusive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "indexable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ogImageUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "Product" SET "status" = 'ACTIVE' WHERE "active" = true;
ALTER TABLE "Product" DROP COLUMN "active";

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "backorderPolicy" "BackorderPolicy" NOT NULL DEFAULT 'DENY',
ADD COLUMN     "compareAtPriceCents" INTEGER,
ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "imageId" UUID,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "reservedInventory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "claimExpiresAt" TIMESTAMP(3),
ADD COLUMN     "claimTokenHash" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "shippingCountry" TEXT NOT NULL DEFAULT 'AU',
ADD COLUMN     "shippingLine1" TEXT,
ADD COLUMN     "shippingLine2" TEXT,
ADD COLUMN     "shippingName" TEXT,
ADD COLUMN     "shippingPostcode" TEXT,
ADD COLUMN     "shippingState" TEXT,
ADD COLUMN     "shippingSuburb" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- Add immutable order snapshots without breaking databases that already contain orders.
ALTER TABLE "OrderItem" ADD COLUMN "productName" TEXT,
ADD COLUMN "productType" "ProductType",
ADD COLUMN "sku" TEXT,
ADD COLUMN "variantName" TEXT;

UPDATE "OrderItem" item
SET "productName" = product."name",
    "productType" = product."type",
    "sku" = variant."sku",
    "variantName" = variant."name"
FROM "ProductVariant" variant
JOIN "Product" product ON product."id" = variant."productId"
WHERE item."variantId" = variant."id";

ALTER TABLE "OrderItem" ALTER COLUMN "productName" SET NOT NULL,
ALTER COLUMN "productType" SET NOT NULL,
ALTER COLUMN "sku" SET NOT NULL,
ALTER COLUMN "variantName" SET NOT NULL;

-- AlterTable
ALTER TABLE "NFCTag" ADD COLUMN     "assembledAt" TIMESTAMP(3),
ADD COLUMN     "batchSequence" INTEGER,
ADD COLUMN     "manufacturingBatchId" UUID,
ADD COLUMN     "manufacturingStatus" "ManufacturingStatus" NOT NULL DEFAULT 'GENERATED',
ADD COLUMN     "programmedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "faq" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CustomisationFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "maxLength" INTEGER,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "helpText" TEXT,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOptionValue" (
    "id" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionKeyHash" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "personalisation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "orderId" UUID,
    "actorId" UUID,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingBatch" (
    "id" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "productId" UUID NOT NULL,
    "productVariantId" UUID,
    "quantity" INTEGER NOT NULL,
    "status" "ManufacturingStatus" NOT NULL DEFAULT 'GENERATED',
    "createdById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'TapKind',
    "businessName" TEXT,
    "supportEmail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "defaultCountry" TEXT NOT NULL DEFAULT 'AU',
    "siteTitle" TEXT NOT NULL DEFAULT 'TapKind NFC',
    "siteDescription" TEXT NOT NULL DEFAULT 'Smart NFC products designed and made in Australia.',
    "defaultSocialImageUrl" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "shippingConfig" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_active_sortOrder_idx" ON "ProductCategory"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_storageKey_key" ON "ProductImage"("storageKey");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductOption_productId_active_sortOrder_idx" ON "ProductOption"("productId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_code_key" ON "ProductOption"("productId", "code");

-- CreateIndex
CREATE INDEX "ProductOptionValue_optionId_active_sortOrder_idx" ON "ProductOptionValue"("optionId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOptionValue_optionId_value_key" ON "ProductOptionValue"("optionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_sessionKeyHash_key" ON "Cart"("sessionKeyHash");

-- CreateIndex
CREATE INDEX "Cart_userId_updatedAt_idx" ON "Cart"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Cart_expiresAt_idx" ON "Cart"("expiresAt");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingBatch_batchNumber_key" ON "ManufacturingBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ManufacturingBatch_status_createdAt_idx" ON "ManufacturingBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ManufacturingBatch_productId_createdAt_idx" ON "ManufacturingBatch"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Product_status_featured_idx" ON "Product"("status", "featured");

-- CreateIndex
CREATE INDEX "ProductVariant_trackInventory_inventory_idx" ON "ProductVariant"("trackInventory", "inventory");

-- CreateIndex
CREATE UNIQUE INDEX "Order_claimTokenHash_key" ON "Order"("claimTokenHash");

-- CreateIndex
CREATE INDEX "Order_guestEmail_createdAt_idx" ON "Order"("guestEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NFCTag_manufacturingStatus_createdAt_idx" ON "NFCTag"("manufacturingStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NFCTag_manufacturingBatchId_batchSequence_key" ON "NFCTag"("manufacturingBatchId", "batchSequence");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingBatch" ADD CONSTRAINT "ManufacturingBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingBatch" ADD CONSTRAINT "ManufacturingBatch_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingBatch" ADD CONSTRAINT "ManufacturingBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NFCTag" ADD CONSTRAINT "NFCTag_manufacturingBatchId_fkey" FOREIGN KEY ("manufacturingBatchId") REFERENCES "ManufacturingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariants Prisma cannot express directly.
CREATE UNIQUE INDEX "ProductImage_one_primary_per_product" ON "ProductImage"("productId") WHERE "isPrimary" = true;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_owner_required" CHECK ("userId" IS NOT NULL OR "sessionKeyHash" IS NOT NULL);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_required" CHECK ("userId" IS NOT NULL OR "guestEmail" IS NOT NULL);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_non_negative" CHECK ("subtotalCents" >= 0 AND "shippingCents" >= 0 AND "totalCents" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_values_positive" CHECK ("quantity" > 0 AND "unitPriceCents" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_non_negative" CHECK ("amountCents" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_inventory_valid" CHECK ("inventory" >= 0 AND "reservedInventory" >= 0 AND "reservedInventory" <= "inventory" AND "priceCents" >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_quantity_non_zero" CHECK ("quantity" <> 0);
ALTER TABLE "ManufacturingBatch" ADD CONSTRAINT "ManufacturingBatch_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "NFCTag" ADD CONSTRAINT "NFCTag_batch_sequence_positive" CHECK ("batchSequence" IS NULL OR "batchSequence" > 0);
