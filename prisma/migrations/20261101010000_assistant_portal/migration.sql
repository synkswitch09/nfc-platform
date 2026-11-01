-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assistantTrialUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AssistantWorkspace" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL DEFAULT 'claude-sonnet',
    "allowedModelKeys" TEXT[] DEFAULT ARRAY['claude-sonnet', 'claude-haiku']::TEXT[],
    "masterPrompt" TEXT NOT NULL DEFAULT '',
    "businessKnowledge" TEXT NOT NULL DEFAULT '',
    "publishedPrompt" TEXT NOT NULL DEFAULT '',
    "publishedKnowledge" TEXT NOT NULL DEFAULT '',
    "lastStripeSyncedAt" TIMESTAMP(3),
    "knowledgeApprovedAt" TIMESTAMP(3),
    "billingExempt" BOOLEAN NOT NULL DEFAULT false,
    "billingExemptReason" TEXT,
    "planKey" TEXT NOT NULL DEFAULT 'respond',
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "trialChannel" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeStatus" TEXT,
    "paidThrough" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "checkoutAttemptId" TEXT,
    "checkoutAttemptAt" TIMESTAMP(3),
    "checkoutSessionId" TEXT,
    "checkoutLockUntil" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "retentionAt" TIMESTAMP(3),
    "finalNoticeAt" TIMESTAMP(3),
    "widgetKey" TEXT NOT NULL,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseToComments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "origin" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantAuthToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantUsage" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "responses" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantConversation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WEB',
    "humanOnly" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "requestId" TEXT,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantNotice" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "noticeKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantSupportMessage" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantSupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantWorkspace_stripeCustomerId_key" ON "AssistantWorkspace"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantWorkspace_stripeSubscriptionId_key" ON "AssistantWorkspace"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantWorkspace_widgetKey_key" ON "AssistantWorkspace"("widgetKey");

-- CreateIndex
CREATE INDEX "AssistantWorkspace_ownerId_idx" ON "AssistantWorkspace"("ownerId");

-- CreateIndex
CREATE INDEX "AssistantWorkspace_retentionAt_idx" ON "AssistantWorkspace"("retentionAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantWorkspace_ownerId_name_key" ON "AssistantWorkspace"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantSession_tokenHash_key" ON "AssistantSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AssistantSession_expiresAt_idx" ON "AssistantSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantAuthToken_tokenHash_key" ON "AssistantAuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AssistantAuthToken_expiresAt_idx" ON "AssistantAuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantUsage_workspaceId_period_key" ON "AssistantUsage"("workspaceId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversation_tokenHash_key" ON "AssistantConversation"("tokenHash");

-- CreateIndex
CREATE INDEX "AssistantConversation_workspaceId_updatedAt_idx" ON "AssistantConversation"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_conversationId_createdAt_idx" ON "AssistantMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantMessage_conversationId_requestId_key" ON "AssistantMessage"("conversationId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantNotice_workspaceId_noticeKey_key" ON "AssistantNotice"("workspaceId", "noticeKey");

-- CreateIndex
CREATE INDEX "AssistantSupportMessage_workspaceId_createdAt_idx" ON "AssistantSupportMessage"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantWorkspace" ADD CONSTRAINT "AssistantWorkspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSession" ADD CONSTRAINT "AssistantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantAuthToken" ADD CONSTRAINT "AssistantAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AssistantWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AssistantWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantNotice" ADD CONSTRAINT "AssistantNotice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AssistantWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSupportMessage" ADD CONSTRAINT "AssistantSupportMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AssistantWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "AssistantWorkspace" ADD CONSTRAINT "AssistantWorkspace_exemption_check" CHECK (NOT "billingExempt" OR ("billingExemptReason" IS NOT NULL AND length(trim("billingExemptReason")) > 0));
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_counts_check" CHECK ("responses" >= 0 AND "inputTokens" >= 0 AND "outputTokens" >= 0);
