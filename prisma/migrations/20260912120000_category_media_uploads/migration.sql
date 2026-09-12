CREATE TABLE "CategoryImage" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryImage_storageKey_key" ON "CategoryImage"("storageKey");
CREATE INDEX "CategoryImage_storeId_categoryId_createdAt_idx" ON "CategoryImage"("storeId", "categoryId", "createdAt");

ALTER TABLE "CategoryImage" ADD CONSTRAINT "CategoryImage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryImage" ADD CONSTRAINT "CategoryImage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
