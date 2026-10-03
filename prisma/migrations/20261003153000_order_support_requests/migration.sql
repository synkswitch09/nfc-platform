CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN','IN_REVIEW','RESOLVED');
CREATE TABLE "OrderSupportRequest" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderSupportRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderSupportRequest_storeId_status_createdAt_idx" ON "OrderSupportRequest"("storeId","status","createdAt");
CREATE INDEX "OrderSupportRequest_orderId_createdAt_idx" ON "OrderSupportRequest"("orderId","createdAt");
ALTER TABLE "OrderSupportRequest" ADD CONSTRAINT "OrderSupportRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderSupportRequest" ADD CONSTRAINT "OrderSupportRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
