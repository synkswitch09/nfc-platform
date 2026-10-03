CREATE TYPE "PromotionKind" AS ENUM ('PERCENT','FIXED','FREE_SHIPPING');
ALTER TABLE "Store" ADD COLUMN "secondPurchaseRewardEnabled" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "Promotion" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "kind" "PromotionKind" NOT NULL,
  "percent" INTEGER,
  "amountCents" INTEGER,
  "productId" UUID,
  "minimumSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  "maxShippingDiscountCents" INTEGER,
  "maxShippingWeightGrams" INTEGER,
  "allowedEmailHash" TEXT,
  "usageLimit" INTEGER,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Order" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "promotionId" UUID;
CREATE UNIQUE INDEX "Promotion_storeId_code_key" ON "Promotion"("storeId","code");
CREATE INDEX "Promotion_storeId_active_startsAt_endsAt_idx" ON "Promotion"("storeId","active","startsAt","endsAt");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
