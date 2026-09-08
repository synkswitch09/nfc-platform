ALTER TABLE "EmailVerification" ADD COLUMN "orderClaimId" UUID;
CREATE INDEX "EmailVerification_orderClaimId_idx" ON "EmailVerification"("orderClaimId");
