-- Extend the existing Kosykin keychain without changing product identity or orders.
INSERT INTO "ProductOptionValue" ("id", "optionId", "label", "value", "sortOrder", "active")
SELECT gen_random_uuid(), o."id", choice."label", choice."value", choice."sortOrder", true
FROM "ProductOption" o
JOIN "Product" p ON p."id" = o."productId"
JOIN "Store" s ON s."id" = p."storeId"
CROSS JOIN (VALUES
  ('Rounded italic', 'roundedItalic', 3),
  ('Classic italic', 'classicItalic', 4),
  ('Compact bold', 'compact', 5)
) AS choice("label", "value", "sortOrder")
WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain' AND o."code" = 'keychain-font'
ON CONFLICT ("optionId", "value") DO NOTHING;

INSERT INTO "ProductOption" ("id", "productId", "name", "code", "type", "required", "sortOrder", "active", "helpText")
SELECT gen_random_uuid(), p."id", 'Keyring hardware', 'keyring-hardware', 'SELECT', true,
       COALESCE((SELECT MAX(o."sortOrder") + 1 FROM "ProductOption" o WHERE o."productId" = p."id"), 8), true,
       'Choose a ring or clasp when you select the keyring loop.'
FROM "Product" p JOIN "Store" s ON s."id" = p."storeId"
WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
ON CONFLICT ("productId", "code") DO NOTHING;

INSERT INTO "ProductOptionValue" ("id", "optionId", "label", "value", "sortOrder", "active")
SELECT gen_random_uuid(), o."id", choice."label", choice."value", choice."sortOrder", true
FROM "ProductOption" o
JOIN "Product" p ON p."id" = o."productId"
JOIN "Store" s ON s."id" = p."storeId"
CROSS JOIN (VALUES
  ('Silver split ring', 'split-ring', 0),
  ('Silver clasp', 'silver-clasp', 1),
  ('Rose gold clasp', 'rose-gold-clasp', 2),
  ('Gold clasp', 'gold-clasp', 3),
  ('No hardware (tag)', 'none', 4)
) AS choice("label", "value", "sortOrder")
WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain' AND o."code" = 'keyring-hardware'
ON CONFLICT ("optionId", "value") DO NOTHING;
