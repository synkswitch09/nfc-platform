ALTER TYPE "MarketplaceSyncJobType" ADD VALUE 'RECEIPTS';

ALTER TABLE "MarketplaceConnection" ADD COLUMN "lastOrderSyncedAt" TIMESTAMP(3);

CREATE TABLE "MarketplaceOrder" (
  "id" UUID NOT NULL,
  "connectionId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalState" TEXT,
  "externalData" JSONB NOT NULL DEFAULT '{}',
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceOrder_orderId_key" ON "MarketplaceOrder"("orderId");
CREATE UNIQUE INDEX "MarketplaceOrder_connectionId_externalId_key" ON "MarketplaceOrder"("connectionId", "externalId");
CREATE INDEX "MarketplaceOrder_connectionId_importedAt_idx" ON "MarketplaceOrder"("connectionId", "importedAt");

ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MarketplaceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
