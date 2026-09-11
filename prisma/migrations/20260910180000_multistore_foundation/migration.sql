-- Multi-store foundation (expand -> backfill -> constrain).
-- Every existing row is assigned to the canonical Tapkin store. Public NFC IDs,
-- order numbers, product IDs and all historical relations remain unchanged.

CREATE TYPE "StoreStatus" AS ENUM ('DRAFT', 'ACTIVE', 'HIDDEN', 'ARCHIVED');
CREATE TYPE "StoreCapability" AS ENUM ('COMMERCE', 'NFC', 'DIGITAL_PROFILE', 'PET_PROFILE', 'CHILD_SAFETY', 'SOCIAL_PROFILE', 'BUSINESS_PROFILE', 'CUSTOM_PERSONALISATION', 'PRINT_3D', 'INVENTORY');
CREATE TYPE "StoreMembershipRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');
CREATE TYPE "DeploymentEnvironment" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION');

CREATE TABLE "Store" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'DRAFT',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "supportEmail" TEXT,
    "country" CHAR(2) NOT NULL DEFAULT 'AU',
    "currency" CHAR(3) NOT NULL DEFAULT 'AUD',
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Adelaide',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "homepage" JSONB NOT NULL DEFAULT '{}',
    "seoTitle" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,
    "socialImageUrl" TEXT,
    "organization" JSONB NOT NULL DEFAULT '{}',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "shippingConfig" JSONB NOT NULL DEFAULT '{}',
    "capabilities" "StoreCapability"[] NOT NULL DEFAULT ARRAY[]::"StoreCapability"[],
    "paymentProfileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreDomain" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "environment" "DeploymentEnvironment" NOT NULL,
    "hostname" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'https',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreMembership" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "StoreMembershipRole" NOT NULL DEFAULT 'CUSTOMER',
    "marketingConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreMembership_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Store" (
    "id", "slug", "name", "displayName", "legalName", "status", "supportEmail",
    "country", "currency", "timezone", "theme", "homepage", "seoTitle",
    "seoDescription", "socialImageUrl", "organization", "socialLinks",
    "shippingConfig", "capabilities", "updatedAt"
)
SELECT
    '00000000-0000-4000-8000-000000000001'::UUID,
    'tapkin',
    COALESCE((SELECT "storeName" FROM "StoreSettings" WHERE "id" = 'default'), 'Tapkin'),
    'Tapkin',
    (SELECT "businessName" FROM "StoreSettings" WHERE "id" = 'default'),
    'ACTIVE'::"StoreStatus",
    (SELECT "supportEmail" FROM "StoreSettings" WHERE "id" = 'default'),
    COALESCE((SELECT "defaultCountry" FROM "StoreSettings" WHERE "id" = 'default'), 'AU'),
    COALESCE((SELECT "currency" FROM "StoreSettings" WHERE "id" = 'default'), 'AUD'),
    'Australia/Adelaide',
    '{"accent":"#ee6c4d","accentSecondary":"#2f7f77","background":"#f7f3eb","foreground":"#14213d","radius":"1.25rem","fontStyle":"editorial"}'::JSONB,
    '{"variant":"tapkin","heroEyebrow":"Smart products, thoughtfully connected","heroHeadline":"Useful objects with a digital superpower","heroDescription":"Personalised products made in Australia with 3D printing, NFC and QR.","primaryCtaLabel":"Shop smart products","primaryCtaHref":"/shop"}'::JSONB,
    COALESCE((SELECT "siteTitle" FROM "StoreSettings" WHERE "id" = 'default'), 'Tapkin Smart Products'),
    COALESCE((SELECT "siteDescription" FROM "StoreSettings" WHERE "id" = 'default'), 'Personalised smart products combining 3D printing, NFC, QR and secure digital profiles.'),
    (SELECT "defaultSocialImageUrl" FROM "StoreSettings" WHERE "id" = 'default'),
    '{"type":"Organization","name":"Tapkin"}'::JSONB,
    COALESCE((SELECT "socialLinks" FROM "StoreSettings" WHERE "id" = 'default'), '{}'::JSONB),
    COALESCE((SELECT "shippingConfig" FROM "StoreSettings" WHERE "id" = 'default'), '{}'::JSONB),
    ARRAY['COMMERCE', 'NFC', 'DIGITAL_PROFILE', 'PET_PROFILE', 'CHILD_SAFETY', 'SOCIAL_PROFILE', 'BUSINESS_PROFILE', 'CUSTOM_PERSONALISATION', 'PRINT_3D', 'INVENTORY']::"StoreCapability"[],
    CURRENT_TIMESTAMP;

INSERT INTO "StoreDomain" ("id", "storeId", "environment", "hostname", "protocol", "isPrimary", "updatedAt") VALUES
('00000000-0000-4000-8100-000000000001', '00000000-0000-4000-8000-000000000001', 'DEVELOPMENT', 'localhost', 'http', true, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000002', '00000000-0000-4000-8000-000000000001', 'DEVELOPMENT', '127.0.0.1', 'http', false, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000003', '00000000-0000-4000-8000-000000000001', 'DEVELOPMENT', 'develop.tapkin.com.au', 'https', false, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000004', '00000000-0000-4000-8000-000000000001', 'STAGING', 'staging.tapkin.com.au', 'https', true, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000005', '00000000-0000-4000-8000-000000000001', 'PRODUCTION', 'tapkin.com.au', 'https', true, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000006', '00000000-0000-4000-8000-000000000001', 'PRODUCTION', 'www.tapkin.com.au', 'https', false, CURRENT_TIMESTAMP);

INSERT INTO "StoreMembership" ("id", "storeId", "userId", "role", "updatedAt")
SELECT
    md5('tapkin-membership:' || "id"::TEXT)::UUID,
    '00000000-0000-4000-8000-000000000001'::UUID,
    "id",
    CASE "role"
        WHEN 'ADMIN' THEN 'ADMIN'::"StoreMembershipRole"
        WHEN 'STAFF' THEN 'STAFF'::"StoreMembershipRole"
        ELSE 'CUSTOMER'::"StoreMembershipRole"
    END,
    CURRENT_TIMESTAMP
FROM "User";

ALTER TABLE "Session" ADD COLUMN "storeId" UUID;
ALTER TABLE "EmailVerification" ADD COLUMN "storeId" UUID;
ALTER TABLE "PasswordReset" ADD COLUMN "storeId" UUID;
ALTER TABLE "Product" ADD COLUMN "storeId" UUID;
ALTER TABLE "ProductCategory" ADD COLUMN "storeId" UUID;
ALTER TABLE "Cart" ADD COLUMN "storeId" UUID;
ALTER TABLE "Order"
    ADD COLUMN "storeId" UUID,
    ADD COLUMN "sourceDomain" TEXT,
    ADD COLUMN "checkoutEnvironment" "DeploymentEnvironment",
    ADD COLUMN "storeDisplayName" TEXT;
ALTER TABLE "ManufacturingBatch" ADD COLUMN "storeId" UUID;
ALTER TABLE "NFCTag" ADD COLUMN "storeId" UUID;
ALTER TABLE "AuditLog" ADD COLUMN "storeId" UUID;

UPDATE "Session" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "EmailVerification" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "PasswordReset" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "Product" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "ProductCategory" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "Cart" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "Order" SET
    "storeId" = '00000000-0000-4000-8000-000000000001',
    "sourceDomain" = 'tapkin.com.au',
    "checkoutEnvironment" = 'DEVELOPMENT',
    "storeDisplayName" = 'Tapkin';
UPDATE "ManufacturingBatch" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "NFCTag" SET "storeId" = '00000000-0000-4000-8000-000000000001';
UPDATE "AuditLog" SET "storeId" = '00000000-0000-4000-8000-000000000001';

ALTER TABLE "Session" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "EmailVerification" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "PasswordReset" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "ProductCategory" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Cart" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "sourceDomain" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "checkoutEnvironment" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "storeDisplayName" SET NOT NULL;
ALTER TABLE "ManufacturingBatch" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "NFCTag" ALTER COLUMN "storeId" SET NOT NULL;

DROP INDEX "Session_userId_idx";
DROP INDEX "EmailVerification_userId_expiresAt_idx";
DROP INDEX "PasswordReset_userId_expiresAt_idx";
DROP INDEX "Product_slug_key";
DROP INDEX "Product_categoryId_status_idx";
DROP INDEX "Product_status_featured_idx";
DROP INDEX "ProductCategory_slug_key";
DROP INDEX "ProductCategory_status_sortOrder_idx";
DROP INDEX "ProductCategory_status_showOnHomepage_sortOrder_idx";
DROP INDEX "ProductCategory_status_showInNavigation_sortOrder_idx";
DROP INDEX "ProductCategory_status_showInShop_sortOrder_idx";
DROP INDEX "Cart_userId_updatedAt_idx";
DROP INDEX "Order_userId_createdAt_idx";
DROP INDEX "Order_guestEmail_createdAt_idx";
DROP INDEX "Order_status_createdAt_idx";
DROP INDEX "ManufacturingBatch_status_createdAt_idx";
DROP INDEX "ManufacturingBatch_productId_createdAt_idx";
DROP INDEX "NFCTag_ownerId_status_idx";
DROP INDEX "NFCTag_productId_status_idx";

CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");
CREATE INDEX "Store_status_name_idx" ON "Store"("status", "name");
CREATE UNIQUE INDEX "StoreDomain_environment_hostname_key" ON "StoreDomain"("environment", "hostname");
CREATE INDEX "StoreDomain_storeId_environment_isPrimary_idx" ON "StoreDomain"("storeId", "environment", "isPrimary");
CREATE UNIQUE INDEX "StoreMembership_storeId_userId_key" ON "StoreMembership"("storeId", "userId");
CREATE INDEX "StoreMembership_userId_role_idx" ON "StoreMembership"("userId", "role");
CREATE INDEX "Session_userId_storeId_idx" ON "Session"("userId", "storeId");
CREATE INDEX "EmailVerification_userId_storeId_expiresAt_idx" ON "EmailVerification"("userId", "storeId", "expiresAt");
CREATE INDEX "PasswordReset_userId_storeId_expiresAt_idx" ON "PasswordReset"("userId", "storeId", "expiresAt");
CREATE UNIQUE INDEX "Product_storeId_slug_key" ON "Product"("storeId", "slug");
CREATE INDEX "Product_storeId_categoryId_status_idx" ON "Product"("storeId", "categoryId", "status");
CREATE INDEX "Product_storeId_status_featured_idx" ON "Product"("storeId", "status", "featured");
CREATE UNIQUE INDEX "ProductCategory_storeId_slug_key" ON "ProductCategory"("storeId", "slug");
CREATE INDEX "ProductCategory_storeId_status_sortOrder_idx" ON "ProductCategory"("storeId", "status", "sortOrder");
CREATE INDEX "ProductCategory_storeId_status_showOnHomepage_sortOrder_idx" ON "ProductCategory"("storeId", "status", "showOnHomepage", "sortOrder");
CREATE INDEX "ProductCategory_storeId_status_showInNavigation_sortOrder_idx" ON "ProductCategory"("storeId", "status", "showInNavigation", "sortOrder");
CREATE INDEX "ProductCategory_storeId_status_showInShop_sortOrder_idx" ON "ProductCategory"("storeId", "status", "showInShop", "sortOrder");
CREATE INDEX "Cart_storeId_userId_updatedAt_idx" ON "Cart"("storeId", "userId", "updatedAt");
CREATE INDEX "Order_storeId_userId_createdAt_idx" ON "Order"("storeId", "userId", "createdAt");
CREATE INDEX "Order_storeId_guestEmail_createdAt_idx" ON "Order"("storeId", "guestEmail", "createdAt");
CREATE INDEX "Order_storeId_status_createdAt_idx" ON "Order"("storeId", "status", "createdAt");
CREATE INDEX "ManufacturingBatch_storeId_status_createdAt_idx" ON "ManufacturingBatch"("storeId", "status", "createdAt");
CREATE INDEX "ManufacturingBatch_storeId_productId_createdAt_idx" ON "ManufacturingBatch"("storeId", "productId", "createdAt");
CREATE INDEX "NFCTag_storeId_ownerId_status_idx" ON "NFCTag"("storeId", "ownerId", "status");
CREATE INDEX "NFCTag_storeId_productId_status_idx" ON "NFCTag"("storeId", "productId", "status");
CREATE INDEX "AuditLog_storeId_createdAt_idx" ON "AuditLog"("storeId", "createdAt");

ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturingBatch" ADD CONSTRAINT "ManufacturingBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NFCTag" ADD CONSTRAINT "NFCTag_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
