-- CreateTable
CREATE TABLE "StoreExperience" (
    "storeId" UUID NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreExperience_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "GiftCampaign" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "giftName" TEXT NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 50,
    "awardedCount" INTEGER NOT NULL DEFAULT 0,
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderGift" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "cycle" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "giftName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "packedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderGift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCampaign_storeId_key_key" ON "GiftCampaign"("storeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "OrderGift_orderId_campaignId_key" ON "OrderGift"("orderId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderGift_campaignId_cycle_sequence_key" ON "OrderGift"("campaignId", "cycle", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_orderItemId_key" ON "ProductReview"("orderItemId");

-- CreateIndex
CREATE INDEX "ProductReview_storeId_status_createdAt_idx" ON "ProductReview"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_orderId_productId_key" ON "ProductReview"("orderId", "productId");

-- AddForeignKey
ALTER TABLE "StoreExperience" ADD CONSTRAINT "StoreExperience_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCampaign" ADD CONSTRAINT "GiftCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCampaign" ADD CONSTRAINT "GiftCampaign_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderGift" ADD CONSTRAINT "OrderGift_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderGift" ADD CONSTRAINT "OrderGift_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GiftCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GiftCampaign" ADD CONSTRAINT "GiftCampaign_limit_check" CHECK ("limit" > 0 AND "awardedCount" >= 0 AND "awardedCount" <= "limit" AND "cycle" > 0);
ALTER TABLE "OrderGift" ADD CONSTRAINT "OrderGift_quantity_check" CHECK ("quantity" = 1 AND "sequence" > 0 AND "cycle" > 0);
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_status_check" CHECK ("status" IN ('PENDING', 'PUBLISHED', 'HIDDEN'));

