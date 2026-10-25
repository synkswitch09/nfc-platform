-- Remove only the stale counter on Kosykin's already-made-to-order keychain.
-- Preserve physical-stock variants, reservations, prices and production times.
-- Record the correction in the inventory ledger; a rerun is a no-op.
WITH candidates AS (
  SELECT v."id", v."inventory"
  FROM "ProductVariant" v
  JOIN "Product" p ON p."id" = v."productId"
  JOIN "Store" s ON s."id" = p."storeId"
  WHERE s."slug" = 'kosykin'
    AND v."sku" = 'KOS-NAME-3D'
    AND v."trackInventory" = false
    AND v."productionMinutes" > 0
    AND v."reservedInventory" = 0
    AND v."inventory" > 0
  FOR UPDATE OF v
), corrected AS (
  UPDATE "ProductVariant" v
  SET "inventory" = 0, "updatedAt" = CURRENT_TIMESTAMP
  FROM candidates c
  WHERE v."id" = c."id"
  RETURNING v."id", c."inventory" AS old_inventory
)
INSERT INTO "InventoryMovement" ("id", "variantId", "type", "quantity", "reason", "createdAt")
SELECT gen_random_uuid(), "id", 'ADJUSTMENT', -old_inventory,
       'Remove legacy stock counter from made-to-order KOS-NAME-3D', CURRENT_TIMESTAMP
FROM corrected;
