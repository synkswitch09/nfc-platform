ALTER TABLE "Store" ADD COLUMN "accountConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "StoreMembership" ADD COLUMN "operationsRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "operationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Address" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Address_one_default_per_user" ON "Address" ("userId") WHERE "isDefault" = true;
ALTER TABLE "OrderSupportRequest" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "replies" JSONB NOT NULL DEFAULT '[]';
CREATE TABLE "CustomerAccountData" ("id" UUID NOT NULL, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE RESTRICT, "favourites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "cart" JSONB NOT NULL DEFAULT '[]', "notificationsReadAt" TIMESTAMP(3), "deletionRequestedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CustomerAccountData_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CustomerAccountData_storeId_userId_key" ON "CustomerAccountData" ("storeId", "userId");
CREATE TABLE "TeamInvitation" ("id" UUID NOT NULL, "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE RESTRICT, "email" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "invitedBy" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation" ("tokenHash");
CREATE INDEX "TeamInvitation_storeId_email_idx" ON "TeamInvitation" ("storeId", "email");

UPDATE "Address" SET "isDefault" = true WHERE "id" IN (SELECT DISTINCT ON ("userId") "id" FROM "Address" ORDER BY "userId", "createdAt", "id");
