-- Let customers select a name-following or rounded rectangular backing.
WITH new_option AS (
  INSERT INTO "ProductOption" ("id", "productId", "name", "code", "type", "required", "sortOrder", "active", "helpText")
  SELECT gen_random_uuid(), p."id", 'Backing shape', 'base-shape', 'RADIO', true, 22, true,
    'Choose a backing that follows the letters or a rounded rectangle.'
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
  ('Follows the name', 'contour', 0),
  ('Rounded rectangle', 'rectangle', 1)
) AS v(label, value, sort_order)
ON CONFLICT ("optionId", "value") DO UPDATE SET "active" = true, "label" = EXCLUDED."label";
