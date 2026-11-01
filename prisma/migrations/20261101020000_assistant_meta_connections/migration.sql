-- AlterTable
ALTER TABLE "AssistantConversation" ADD COLUMN     "externalThreadId" TEXT,
ADD COLUMN     "lastCustomerMessageAt" TIMESTAMP(3),
ADD COLUMN     "socialConnectionId" UUID;

-- AlterTable
ALTER TABLE "AssistantMessage" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "AssistantSocialConnection" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "authorizingUserId" TEXT NOT NULL,
    "tokenCiphertext" TEXT,
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "autoMessages" BOOLEAN NOT NULL DEFAULT false,
    "autoComments" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMetaFlow" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "withComments" BOOLEAN NOT NULL DEFAULT false,
    "phase" TEXT NOT NULL DEFAULT 'AUTHORIZING',
    "candidatesCiphertext" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMetaFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantSocialEvent" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "replyText" TEXT,
    "errorCode" TEXT,
    "externalReplyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSocialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantSocialConnection_authorizingUserId_idx" ON "AssistantSocialConnection"("authorizingUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantSocialConnection_provider_accountId_key" ON "AssistantSocialConnection"("provider", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantSocialConnection_workspaceId_provider_key" ON "AssistantSocialConnection"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantMetaFlow_stateHash_key" ON "AssistantMetaFlow"("stateHash");

-- CreateIndex
CREATE INDEX "AssistantMetaFlow_expiresAt_idx" ON "AssistantMetaFlow"("expiresAt");

-- CreateIndex
CREATE INDEX "AssistantMetaFlow_workspaceId_userId_idx" ON "AssistantMetaFlow"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "AssistantSocialEvent_status_createdAt_idx" ON "AssistantSocialEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantSocialEvent_connectionId_eventKey_key" ON "AssistantSocialEvent"("connectionId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversation_socialConnectionId_externalThreadId_key" ON "AssistantConversation"("socialConnectionId", "externalThreadId");

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "AssistantSocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSocialConnection" ADD CONSTRAINT "AssistantSocialConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AssistantWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMetaFlow" ADD CONSTRAINT "AssistantMetaFlow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AssistantWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSocialEvent" ADD CONSTRAINT "AssistantSocialEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AssistantSocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fail closed if records are written outside the validated API.
ALTER TABLE "AssistantSocialConnection" ADD CONSTRAINT "AssistantSocialConnection_provider_check" CHECK ("provider" IN ('FACEBOOK','INSTAGRAM'));
ALTER TABLE "AssistantSocialConnection" ADD CONSTRAINT "AssistantSocialConnection_status_check" CHECK ("status" IN ('CONNECTED','DISCONNECTED','REAUTH_REQUIRED'));
ALTER TABLE "AssistantSocialConnection" ADD CONSTRAINT "AssistantSocialConnection_connected_token_check" CHECK ("status" <> 'CONNECTED' OR "tokenCiphertext" IS NOT NULL);
ALTER TABLE "AssistantSocialEvent" ADD CONSTRAINT "AssistantSocialEvent_status_check" CHECK ("status" IN ('PENDING','GENERATING','READY','SENDING','SENT','SKIPPED','FAILED','UNCERTAIN'));
