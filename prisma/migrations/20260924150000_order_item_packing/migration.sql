ALTER TABLE "OrderItem" ADD COLUMN "packedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "packedAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_packed_quantity_valid"
CHECK ("packedQuantity" >= 0 AND "packedQuantity" <= "quantity");
