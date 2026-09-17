CREATE TYPE "MarketplaceKind" AS ENUM ('ETSY');
CREATE TYPE "MarketplaceConnectionStatus" AS ENUM ('CONNECTING', 'ACTIVE', 'EXPIRED', 'ERROR', 'DISCONNECTED');
CREATE TYPE "MarketplaceSyncJobType" AS ENUM ('INVENTORY');
CREATE TYPE "MarketplaceSyncJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "MarketplaceConnection" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "kind" "MarketplaceKind" NOT NULL,
  "status" "MarketplaceConnectionStatus" NOT NULL DEFAULT 'CONNECTING',
  "shopId" TEXT,
  "shopName" TEXT,
  "sellerId" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "listingDefaults" JSONB NOT NULL DEFAULT '{}',
  "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "connectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceListing" (
  "id" UUID NOT NULL,
  "connectionId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalUrl" TEXT,
  "state" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceSyncJob" (
  "id" UUID NOT NULL,
  "connectionId" UUID NOT NULL,
  "listingId" UUID,
  "type" "MarketplaceSyncJobType" NOT NULL,
  "status" "MarketplaceSyncJobStatus" NOT NULL DEFAULT 'QUEUED',
  "dedupeKey" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "lastError" TEXT,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceConnection_storeId_kind_key" ON "MarketplaceConnection"("storeId", "kind");
CREATE INDEX "MarketplaceConnection_storeId_status_idx" ON "MarketplaceConnection"("storeId", "status");
CREATE UNIQUE INDEX "MarketplaceListing_connectionId_productId_key" ON "MarketplaceListing"("connectionId", "productId");
CREATE UNIQUE INDEX "MarketplaceListing_connectionId_externalId_key" ON "MarketplaceListing"("connectionId", "externalId");
CREATE INDEX "MarketplaceListing_productId_idx" ON "MarketplaceListing"("productId");
CREATE UNIQUE INDEX "MarketplaceSyncJob_dedupeKey_key" ON "MarketplaceSyncJob"("dedupeKey");
CREATE INDEX "MarketplaceSyncJob_status_availableAt_idx" ON "MarketplaceSyncJob"("status", "availableAt");
CREATE INDEX "MarketplaceSyncJob_connectionId_status_idx" ON "MarketplaceSyncJob"("connectionId", "status");

ALTER TABLE "MarketplaceConnection" ADD CONSTRAINT "MarketplaceConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MarketplaceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSyncJob" ADD CONSTRAINT "MarketplaceSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MarketplaceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSyncJob" ADD CONSTRAINT "MarketplaceSyncJob_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
