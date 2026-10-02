-- Offer either a bare tag or a keyring loop on the made-to-order name design.
WITH new_option AS (
  INSERT INTO "ProductOption" ("id", "productId", "name", "code", "type", "required", "sortOrder", "active", "helpText")
  SELECT gen_random_uuid(), p."id", 'Finish', 'keychain-attachment', 'RADIO', true, 23, true,
    'Choose a keyring loop or a plain tag without a loop.'
  FROM "Product" p
  JOIN "Store" s ON s."id" = p."storeId"
  WHERE s."slug" = 'kosykin' AND p."slug" = 'custom-name-keychain'
  ON CONFLICT ("productId", "code") DO UPDATE
    SET "active" = true, "required" = true
  RETURNING "id"
)
INSERT INTO "ProductOptionValue" ("id", "optionId", "label", "value", "sortOrder", "active")
SELECT gen_random_uuid(), o."id", v.label, v.value, v.sort_order, true
FROM new_option o
CROSS JOIN (VALUES
  ('Keyring loop', 'keychain', 0),
  ('Plain tag', 'tag', 1)
) AS v(label, value, sort_order)
ON CONFLICT ("optionId", "value") DO UPDATE SET "active" = true, "label" = EXCLUDED."label";
