ALTER TABLE "ProductImage" ADD COLUMN "variantId" UUID;
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId", "sortOrder");
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "ProductImage" AS image SET "variantId" = variant."id"
FROM "ProductVariant" AS variant
WHERE variant."imageId" = image."id" AND image."variantId" IS NULL
  AND variant."id" = (SELECT v."id" FROM "ProductVariant" v WHERE v."imageId" = image."id" ORDER BY v."id" LIMIT 1);
