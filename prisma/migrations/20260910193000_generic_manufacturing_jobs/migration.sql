-- Generic 3D-print manufacturing queue. NFC identity batches remain separate.
-- This is additive: existing orders, items, NFC batches and tags are unchanged.

CREATE TYPE "ManufacturingJobStatus" AS ENUM ('QUEUED', 'PRINTING', 'POST_PROCESSING', 'QA', 'ASSEMBLY', 'PACKING', 'READY', 'FAILED', 'CANCELLED');

CREATE TABLE "ManufacturingJob" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL,
    "status" "ManufacturingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "material" TEXT,
    "colour" TEXT,
    "requiresNfc" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "qaPassed" BOOLEAN,
    "failureReason" TEXT,
    "assignedToId" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManufacturingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManufacturingJob_orderItemId_sequence_key" ON "ManufacturingJob"("orderItemId", "sequence");
CREATE INDEX "ManufacturingJob_storeId_status_priority_createdAt_idx" ON "ManufacturingJob"("storeId", "status", "priority", "createdAt");
CREATE INDEX "ManufacturingJob_productVariantId_status_idx" ON "ManufacturingJob"("productVariantId", "status");
CREATE INDEX "ManufacturingJob_assignedToId_status_idx" ON "ManufacturingJob"("assignedToId", "status");

ALTER TABLE "ManufacturingJob" ADD CONSTRAINT "ManufacturingJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturingJob" ADD CONSTRAINT "ManufacturingJob_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturingJob" ADD CONSTRAINT "ManufacturingJob_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturingJob" ADD CONSTRAINT "ManufacturingJob_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
