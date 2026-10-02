-- Give existing Kosykin keychains the same finish choices as new products.
INSERT INTO "ProductOption" ("id", "productId", "name", "code", "type", "required", "sortOrder", "active", "helpText")
SELECT gen_random_uuid(), p."id", 'Letter finish', 'letter-finish', 'RADIO', true, 5, true,
       'Raised: 3 mm base and 1 mm letters. Flush: letters sit in the top 1 mm of a 4 mm base.'
FROM "Product" p JOIN "Store" s ON s."id" = p."storeId"
WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
ON CONFLICT ("productId", "code") DO NOTHING;

INSERT INTO "ProductOptionValue" ("id", "optionId", "label", "value", "sortOrder", "active")
SELECT gen_random_uuid(), o."id", choice."label", choice."value", choice."sortOrder", true
FROM "ProductOption" o
JOIN "Product" p ON p."id" = o."productId"
JOIN "Store" s ON s."id" = p."storeId"
CROSS JOIN (VALUES ('Raised letters', 'raised', 0), ('Flush letters', 'inlaid', 1)) AS choice("label", "value", "sortOrder")
WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain' AND o."code" = 'letter-finish'
ON CONFLICT ("optionId", "value") DO NOTHING;
