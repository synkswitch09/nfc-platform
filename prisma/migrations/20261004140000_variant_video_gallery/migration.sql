CREATE TABLE "ProductVideo" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVideo_storageKey_key" ON "ProductVideo"("storageKey");
CREATE INDEX "ProductVideo_variantId_sortOrder_idx" ON "ProductVideo"("variantId", "sortOrder");
CREATE INDEX "ProductVideo_productId_idx" ON "ProductVideo"("productId");
ALTER TABLE "ProductVideo" ADD CONSTRAINT "ProductVideo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVideo" ADD CONSTRAINT "ProductVideo_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
