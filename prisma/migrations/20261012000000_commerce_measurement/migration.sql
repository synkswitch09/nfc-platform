CREATE TABLE "MeasurementSession" (
 "id" UUID NOT NULL, "tokenHash" TEXT NOT NULL, "storeId" UUID NOT NULL,
 "clientId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
 "analytics" BOOLEAN NOT NULL DEFAULT false, "advertising" BOOLEAN NOT NULL DEFAULT false,
 "fbp" TEXT, "fbc" TEXT, "clientUserAgent" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MeasurementSession_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MeasurementSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MeasurementSession_tokenHash_key" ON "MeasurementSession"("tokenHash");
CREATE INDEX "MeasurementSession_expiresAt_idx" ON "MeasurementSession"("expiresAt");
ALTER TABLE "Order" ADD COLUMN "measurementSessionId" UUID;
ALTER TABLE "Order" ADD CONSTRAINT "Order_measurementSessionId_fkey" FOREIGN KEY ("measurementSessionId") REFERENCES "MeasurementSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "MeasurementDelivery" (
 "id" UUID NOT NULL, "storeId" UUID NOT NULL, "sessionId" UUID NOT NULL,
 "provider" TEXT NOT NULL, "targetId" TEXT NOT NULL, "eventKey" TEXT NOT NULL, "eventName" TEXT NOT NULL,
 "payload" JSONB NOT NULL, "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sentAt" TIMESTAMP(3), "lastError" TEXT,
 CONSTRAINT "MeasurementDelivery_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MeasurementDelivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "MeasurementDelivery_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeasurementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MeasurementDelivery_storeId_provider_eventKey_key" ON "MeasurementDelivery"("storeId", "provider", "eventKey");
CREATE INDEX "MeasurementDelivery_status_nextAttemptAt_idx" ON "MeasurementDelivery"("status", "nextAttemptAt");
