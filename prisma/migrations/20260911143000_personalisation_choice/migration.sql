CREATE TYPE "PersonalisationChoice" AS ENUM ('BASIC', 'PERSONALISED');

ALTER TABLE "OrderItem"
ADD COLUMN "personalisationChoice" "PersonalisationChoice" NOT NULL DEFAULT 'BASIC';

-- Preserve the pre-mode behaviour for existing products with custom-input fields.
UPDATE "Product"
SET "personalisationMode" = 'REQUIRED'
WHERE EXISTS (
  SELECT 1
  FROM "ProductOption"
  WHERE "ProductOption"."productId" = "Product"."id"
    AND "ProductOption"."active" = true
    AND "ProductOption"."type" IN ('SHORT_TEXT', 'LONG_TEXT', 'CHECKBOX', 'IMAGE')
);

-- Existing order snapshots with submitted values pre-date the explicit choice.
UPDATE "OrderItem"
SET "personalisationChoice" = 'PERSONALISED'
WHERE "personalisation" IS NOT NULL
  AND "personalisation" <> '{}'::jsonb;
