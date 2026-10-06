ALTER TABLE "ProductVariant" ADD COLUMN "modelStorageKey" TEXT;
CREATE UNIQUE INDEX "ProductVariant_modelStorageKey_key" ON "ProductVariant"("modelStorageKey");
