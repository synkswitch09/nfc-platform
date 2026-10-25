ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'DELIVERY', ADD COLUMN "pickupSnapshot" JSONB, ADD COLUMN "collectedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryMethod_check" CHECK ("deliveryMethod" IN ('DELIVERY', 'PICKUP'));
