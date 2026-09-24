ALTER TABLE "Payment" ADD COLUMN "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "refundRestockedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refunded_amount_valid"
CHECK ("refundedAmountCents" >= 0 AND "refundedAmountCents" <= "amountCents");

CREATE TABLE "PaymentRefund" (
 "id" UUID NOT NULL, "paymentId" UUID NOT NULL, "requestKey" TEXT NOT NULL,
 "providerRefundId" TEXT, "amountCents" INTEGER NOT NULL, "currency" TEXT NOT NULL,
 "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'REQUESTED', "lastError" TEXT,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseUntil" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PaymentRefund_amount_valid" CHECK ("amountCents" > 0),
 CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentRefund_requestKey_key" ON "PaymentRefund"("requestKey");
CREATE UNIQUE INDEX "PaymentRefund_providerRefundId_key" ON "PaymentRefund"("providerRefundId");
CREATE INDEX "PaymentRefund_status_nextAttemptAt_idx" ON "PaymentRefund"("status", "nextAttemptAt");

CREATE TABLE "OrderNotification" (
 "id" UUID NOT NULL, "orderId" UUID NOT NULL, "dedupeKey" TEXT NOT NULL,
 "to" TEXT NOT NULL, "subject" TEXT NOT NULL, "text" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseUntil" TIMESTAMP(3),
 "leaseToken" TEXT, "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "OrderNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderNotification_dedupeKey_key" ON "OrderNotification"("dedupeKey");
CREATE INDEX "OrderNotification_status_availableAt_idx" ON "OrderNotification"("status", "availableAt");
