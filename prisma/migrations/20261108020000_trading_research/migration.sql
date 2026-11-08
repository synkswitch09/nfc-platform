CREATE TABLE "TradingResearch" (
 "id" UUID NOT NULL, "botId" UUID NOT NULL, "capitalAud" DOUBLE PRECISION NOT NULL DEFAULT 1000,
 "enabled" BOOLEAN NOT NULL DEFAULT false, "state" JSONB NOT NULL, "dataset" JSONB,
 "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "lastRunAt" TIMESTAMP(3),
 "reviewDay" TEXT, "reviewsToday" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "TradingResearch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradingResearch_botId_key" ON "TradingResearch"("botId");
ALTER TABLE "TradingResearch" ADD CONSTRAINT "TradingResearch_botId_fkey" FOREIGN KEY ("botId") REFERENCES "TradingBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "TradingResearchBatch" (
 "id" UUID NOT NULL, "researchId" UUID NOT NULL, "generation" INTEGER NOT NULL,
 "fingerprint" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "results" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TradingResearchBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradingResearchBatch_researchId_generation_key" ON "TradingResearchBatch"("researchId", "generation");
ALTER TABLE "TradingResearchBatch" ADD CONSTRAINT "TradingResearchBatch_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "TradingResearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
