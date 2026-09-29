ALTER TABLE "Shipment" ADD COLUMN "idempotencyKey" TEXT NOT NULL;
CREATE UNIQUE INDEX "Shipment_idempotencyKey_key" ON "Shipment"("idempotencyKey");
