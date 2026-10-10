-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "loyaltyDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyEligibleCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltySnapshot" JSONB;

-- CreateTable
CREATE TABLE "LoyaltyWallet" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "emailHash" TEXT NOT NULL,
    "userId" UUID,
    "debtPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLot" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "orderId" UUID,
    "originalPoints" INTEGER NOT NULL,
    "remainingPoints" INTEGER NOT NULL,
    "revokedPoints" INTEGER NOT NULL DEFAULT 0,
    "expiredPoints" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyReservation" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "restoredPoints" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAllocation" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "restoredPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LoyaltyAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyEntry" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "orderId" UUID,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyWallet_storeId_userId_idx" ON "LoyaltyWallet"("storeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyWallet_storeId_emailHash_key" ON "LoyaltyWallet"("storeId", "emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLot_orderId_key" ON "LoyaltyLot"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyLot_walletId_expiresAt_idx" ON "LoyaltyLot"("walletId", "expiresAt");

-- CreateIndex
CREATE INDEX "LoyaltyLot_expiresAt_remainingPoints_idx" ON "LoyaltyLot"("expiresAt", "remainingPoints");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyReservation_orderId_key" ON "LoyaltyReservation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAllocation_reservationId_lotId_key" ON "LoyaltyAllocation"("reservationId", "lotId");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_walletId_createdAt_idx" ON "LoyaltyEntry"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyEntry_walletId_eventKey_key" ON "LoyaltyEntry"("walletId", "eventKey");

-- AddForeignKey
ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "LoyaltyWallet_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "LoyaltyWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "LoyaltyLot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "LoyaltyWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "LoyaltyLot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReservation" ADD CONSTRAINT "LoyaltyReservation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "LoyaltyWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReservation" ADD CONSTRAINT "LoyaltyReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAllocation" ADD CONSTRAINT "LoyaltyAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "LoyaltyReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAllocation" ADD CONSTRAINT "LoyaltyAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LoyaltyLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "LoyaltyWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "LoyaltyWallet_debt_nonnegative" CHECK ("debtPoints" >= 0);
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "LoyaltyLot_points_valid" CHECK ("originalPoints" >= 0 AND "remainingPoints" >= 0 AND "revokedPoints" >= 0 AND "expiredPoints" >= 0 AND "remainingPoints" + "revokedPoints" + "expiredPoints" <= "originalPoints");
ALTER TABLE "LoyaltyReservation" ADD CONSTRAINT "LoyaltyReservation_points_valid" CHECK ("points" > 0 AND "discountCents" > 0 AND "restoredPoints" >= 0 AND "restoredPoints" <= "points" AND "status" IN ('HELD','SPENT','RELEASED'));
ALTER TABLE "LoyaltyAllocation" ADD CONSTRAINT "LoyaltyAllocation_points_valid" CHECK ("points" > 0 AND "restoredPoints" >= 0 AND "restoredPoints" <= "points");
ALTER TABLE "Order" ADD CONSTRAINT "Order_loyalty_nonnegative" CHECK ("loyaltyPointsUsed" >= 0 AND "loyaltyDiscountCents" >= 0 AND "loyaltyEligibleCents" >= 0 AND "loyaltyDiscountCents" <= "discountCents");
