CREATE TABLE "ShippitPreparation" (
 "orderId" UUID NOT NULL PRIMARY KEY,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT,
 "leaseUntil" TIMESTAMP(3),
 "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ShippitPreparation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ShippitPreparation_status_availableAt_idx" ON "ShippitPreparation"("status", "availableAt");

-- Resume paid checkout orders that have not been manually fulfilled. Existing
-- shipments are deliberately excluded so rollout cannot create duplicate labels.
INSERT INTO "ShippitPreparation" ("orderId", "updatedAt")
SELECT o."id", CURRENT_TIMESTAMP FROM "Order" o
WHERE o."status" IN ('PAID', 'PROCESSING', 'READY_TO_SHIP')
  AND o."checkoutEnvironment" IN ('STAGING', 'PRODUCTION')
  AND o."shippingProviderKey" IN ('shippit', 'manual')
  AND lower(o."shippingServiceCode") IN ('standard', 'express')
  AND jsonb_typeof(o."packagingSnapshot"->'parcels') = 'array'
  AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId" = o."id" AND p."status" = 'SUCCEEDED')
  AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId" = o."id" AND (p."status" = 'REFUNDED' OR p."refundedAmountCents" > 0))
  AND NOT EXISTS (SELECT 1 FROM "Shipment" s WHERE s."orderId" = o."id")
ON CONFLICT ("orderId") DO NOTHING;
