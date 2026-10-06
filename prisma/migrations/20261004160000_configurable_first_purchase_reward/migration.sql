ALTER TABLE "Store"
  ADD COLUMN "secondPurchaseRewardAmountCents" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "secondPurchaseRewardValidityDays" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN "secondPurchaseRewardMinimumCents" INTEGER NOT NULL DEFAULT 0;
