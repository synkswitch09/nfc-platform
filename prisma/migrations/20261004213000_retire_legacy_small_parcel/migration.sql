-- Move the old seeded STANDARD rate to a generic rate when no generic rate
-- already exists. Product-level packaging assignments are never removed.
UPDATE "ShippingRate" r
SET "packagingId" = NULL
FROM "Packaging" p
WHERE r."packagingId" = p."id"
  AND p."code" = 'SMALL-PARCEL'
  AND NOT EXISTS (SELECT 1 FROM "Product" product WHERE product."defaultPackagingId" = p."id")
  AND NOT EXISTS (
    SELECT 1 FROM "ShippingRate" other
    WHERE other."storeId" = r."storeId"
      AND other."zoneId" = r."zoneId"
      AND other."serviceCode" = r."serviceCode"
      AND other."packagingId" IS NULL
  );

UPDATE "ProductVariant" v
SET "defaultPackagingId" = NULL
FROM "Packaging" p
WHERE v."defaultPackagingId" = p."id"
  AND p."code" = 'SMALL-PARCEL'
  AND NOT EXISTS (SELECT 1 FROM "Product" product WHERE product."defaultPackagingId" = p."id");

DELETE FROM "Packaging" p
WHERE p."code" = 'SMALL-PARCEL'
  AND NOT EXISTS (SELECT 1 FROM "Product" product WHERE product."defaultPackagingId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."defaultPackagingId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "ShippingRate" r WHERE r."packagingId" = p."id");
