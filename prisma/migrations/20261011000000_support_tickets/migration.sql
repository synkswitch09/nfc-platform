-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "preparationStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderSupportRequest" ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerUserId" UUID,
ADD COLUMN     "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN     "holdActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "holdReleaseReason" TEXT,
ADD COLUMN     "holdReleasedAt" TIMESTAMP(3),
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "responseDueAt" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SupportAccess" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "sessionHash" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportNotification" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "emailSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportAccess_sessionHash_key" ON "SupportAccess"("sessionHash");

-- CreateIndex
CREATE INDEX "SupportAccess_storeId_expiresAt_idx" ON "SupportAccess"("storeId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportNotification_dedupeKey_key" ON "SupportNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "SupportNotification_status_availableAt_idx" ON "SupportNotification"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OrderSupportRequest_orderId_holdActive_idx" ON "OrderSupportRequest"("orderId", "holdActive");

-- CreateIndex
CREATE INDEX "OrderSupportRequest_storeId_customerEmail_createdAt_idx" ON "OrderSupportRequest"("storeId", "customerEmail", "createdAt");

-- CreateIndex
CREATE INDEX "OrderSupportRequest_storeId_responseDueAt_idx" ON "OrderSupportRequest"("storeId", "responseDueAt");

-- AddForeignKey
ALTER TABLE "SupportNotification" ADD CONSTRAINT "SupportNotification_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "OrderSupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve existing tickets and first public response; never pause historical orders retroactively.
UPDATE "OrderSupportRequest" t SET "customerUserId" = o."userId", "customerEmail" = COALESCE(u.email, o."guestEmail"), "customerName" = COALESCE(o."customerName",u.name), "verifiedAt" = t."createdAt" FROM "Order" o LEFT JOIN "User" u ON u.id=o."userId" WHERE o.id=t."orderId";
UPDATE "Order" SET "preparationStartedAt" = "updatedAt" WHERE status IN ('PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED','COMPLETED');
UPDATE "OrderSupportRequest" t SET "firstRespondedAt" = (SELECT min((r->>'at')::timestamptz) FROM jsonb_array_elements(t.replies) r WHERE r->>'at' ~ '^\d{4}-\d{2}-\d{2}T');

-- Add pre-purchase and privacy topics to the existing CMS-managed topic list.
UPDATE "Store" SET "accountConfig" = jsonb_set("accountConfig", '{requestTopics}', (SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements("accountConfig"->'requestTopics' || '["GENERAL","PRIVACY","ACCOUNT"]'::jsonb) v)) WHERE jsonb_typeof("accountConfig"->'requestTopics')='array';
