ALTER TABLE "Order"
  ADD COLUMN "shippingCarrier" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "shippedAt" TIMESTAMP(3);

CREATE INDEX "Order_trackingNumber_idx" ON "Order"("trackingNumber");
