-- This template instruction was mistakenly stored as customer-facing help.
-- Preserve every merchant-authored description and other option type.
UPDATE "ProductOption"
SET "helpText" = NULL
WHERE "type" = 'COLOUR'
  AND "helpText" = 'Add the colours available for this product and upload photos for each colour.';
