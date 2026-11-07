CREATE TABLE "TradingBot" (
 "id" UUID NOT NULL, "ownerId" UUID NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false, "entriesPaused" BOOLEAN NOT NULL DEFAULT false,
 "settings" JSONB NOT NULL, "state" JSONB NOT NULL,
 "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "lastRunAt" TIMESTAMP(3), "lastReportAt" TIMESTAMP(3),
 "reportDay" TEXT, "reportsToday" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "TradingBot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradingBot_ownerId_key" ON "TradingBot"("ownerId");
ALTER TABLE "TradingBot" ADD CONSTRAINT "TradingBot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "TradingEvent" (
 "id" UUID NOT NULL, "botId" UUID NOT NULL, "kind" TEXT NOT NULL, "instrumentId" TEXT,
 "message" TEXT NOT NULL, "data" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TradingEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TradingEvent_botId_createdAt_idx" ON "TradingEvent"("botId", "createdAt");
ALTER TABLE "TradingEvent" ADD CONSTRAINT "TradingEvent_botId_fkey" FOREIGN KEY ("botId") REFERENCES "TradingBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
