ALTER TABLE "ProductVariant" ADD COLUMN "productionMinutes" INTEGER;
CREATE TABLE "ProductionPool" (
  "environment" "DeploymentEnvironment" NOT NULL,
  "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 360,
  "maxBusinessDays" INTEGER NOT NULL DEFAULT 10,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionPool_pkey" PRIMARY KEY ("environment")
);
CREATE TABLE "ProductionBooking" (
  "orderId" UUID NOT NULL,
  "environment" "DeploymentEnvironment" NOT NULL,
  "minutes" INTEGER NOT NULL,
  "promisedAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionBooking_pkey" PRIMARY KEY ("orderId")
);
CREATE INDEX "ProductionBooking_environment_releasedAt_createdAt_idx" ON "ProductionBooking"("environment","releasedAt","createdAt");
ALTER TABLE "ProductionBooking" ADD CONSTRAINT "ProductionBooking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionBooking" ADD CONSTRAINT "ProductionBooking_environment_fkey" FOREIGN KEY ("environment") REFERENCES "ProductionPool"("environment") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "ProductVariant" AS variant SET "productionMinutes" = 45
FROM "Product" AS product
WHERE variant."productId" = product."id" AND product."slug" = 'custom-name-keychain';
