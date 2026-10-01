-- Repair the early Kosykin keychain catalog entry without changing its price or stock.
-- No rows are changed when this store has not created the product yet.
INSERT INTO "ProductCategory" (
  "id", "storeId", "slug", "name", "shortDescription", "status",
  "showOnHomepage", "showInNavigation", "showInShop", "showLanding", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."storeId", 'personalised-3d-prints', 'Personalised 3D prints',
  'Made-to-order objects with your chosen name and colours.', 'PUBLISHED',
  false, true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" p
JOIN "Store" s ON s."id" = p."storeId"
WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
ON CONFLICT ("storeId", "slug") DO NOTHING;

UPDATE "Product" p
SET "categoryId" = c."id", "type" = 'CUSTOM', "personalisationMode" = 'REQUIRED', "updatedAt" = CURRENT_TIMESTAMP
FROM "Store" s, "ProductCategory" c
WHERE p."storeId" = s."id" AND c."storeId" = s."id"
  AND s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
  AND c."slug" = 'personalised-3d-prints';

DELETE FROM "ProductOption" o
USING "Product" p, "Store" s
WHERE o."productId" = p."id" AND p."storeId" = s."id"
  AND s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
  AND o."code" NOT IN ('keychain-name', 'keychain-font', 'keychain-size', 'base-colour', 'letter-colour');

UPDATE "ProductOption" o
SET "active" = true, "required" = true,
  "sortOrder" = CASE o."code"
    WHEN 'keychain-name' THEN 0 WHEN 'keychain-font' THEN 1
    WHEN 'keychain-size' THEN 2 WHEN 'base-colour' THEN 3 ELSE 4 END,
  "helpText" = CASE WHEN o."code" = 'keychain-size'
    THEN 'Regular 10 mm, Medium 15 mm, Large 20 mm letters. Long names shrink to fit.'
    ELSE o."helpText" END,
  "maxLength" = CASE WHEN o."code" = 'keychain-name' THEN 24 ELSE o."maxLength" END
FROM "Product" p, "Store" s
WHERE o."productId" = p."id" AND p."storeId" = s."id"
  AND s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain';

INSERT INTO "ProductOptionValue" (
  "id", "optionId", "label", "value", "priceDeltaCents", "sortOrder", "active"
)
SELECT gen_random_uuid(), o."id", 'Medium', 'medium', 0, 1, true
FROM "ProductOption" o
JOIN "Product" p ON p."id" = o."productId"
JOIN "Store" s ON s."id" = p."storeId"
WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
  AND o."code" = 'keychain-size'
ON CONFLICT ("optionId", "value") DO NOTHING;

UPDATE "ProductOptionValue" v
SET "sortOrder" = CASE v."value" WHEN 'regular' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
  "active" = v."value" IN ('regular', 'medium', 'large')
FROM "ProductOption" o, "Product" p, "Store" s
WHERE v."optionId" = o."id" AND o."productId" = p."id" AND p."storeId" = s."id"
  AND s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
  AND o."code" = 'keychain-size';

UPDATE "ProductVariant" v
SET "optionSelection" = '{}'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
FROM "Product" p, "Store" s
WHERE v."productId" = p."id" AND p."storeId" = s."id"
  AND s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
  AND v."optionSelection" <> '{}'::jsonb;
