ALTER TABLE "GiftCampaign" ADD COLUMN "giftProductId" UUID;
ALTER TABLE "GiftCampaign" ADD CONSTRAINT "GiftCampaign_giftProductId_fkey" FOREIGN KEY ("giftProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderGift" ADD COLUMN "variantId" UUID, ADD COLUMN "sku" TEXT, ADD COLUMN "colour" TEXT, ADD COLUMN "colourHex" TEXT, ADD COLUMN "material" TEXT, ADD COLUMN "productionMinutes" INTEGER, ADD COLUMN "requiresPrinting" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "printedAt" TIMESTAMP(3);
ALTER TABLE "OrderGift" ADD CONSTRAINT "OrderGift_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Link only a unique, exact Mini Tray match; never guess between different products or alter previous awards.
UPDATE "GiftCampaign" c SET "giftProductId" = p.id FROM (
 SELECT "storeId", (array_agg(id))[1] AS id FROM "Product"
 WHERE lower(name) = 'wavy mini tray' AND status = 'ACTIVE' GROUP BY "storeId" HAVING count(*) = 1
) p JOIN "Store" s ON s.id = p."storeId" AND s.slug = 'kosykin'
WHERE c."storeId" = p."storeId" AND c.key = 'launch-stands' AND c."giftProductId" IS NULL;
