-- Existing zero-stock made-to-order variants used the inventory flag and could appear sold out.
-- Preserve stocked and reserved variants for an explicit inventory adjustment before conversion.
UPDATE "ProductVariant"
SET "trackInventory" = false,
    "backorderPolicy" = 'DENY',
    "lowStockThreshold" = 0
WHERE "productionMinutes" IS NOT NULL
  AND "trackInventory" = true
  AND "inventory" = 0
  AND "reservedInventory" = 0;
