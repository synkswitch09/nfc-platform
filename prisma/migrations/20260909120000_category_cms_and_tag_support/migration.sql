CREATE TYPE "CategoryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');

ALTER TYPE "ProductStatus" ADD VALUE 'HIDDEN';

ALTER TABLE "Product"
ADD COLUMN "shopVisible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ProductCategory"
ADD COLUMN "shortDescription" TEXT,
ADD COLUMN "icon" TEXT,
ADD COLUMN "cardTitle" TEXT,
ADD COLUMN "cardText" TEXT,
ADD COLUMN "cardImageUrl" TEXT,
ADD COLUMN "heroEyebrow" TEXT,
ADD COLUMN "heroHeadline" TEXT,
ADD COLUMN "heroDescription" TEXT,
ADD COLUMN "heroImageUrl" TEXT,
ADD COLUMN "secondaryImageUrl" TEXT,
ADD COLUMN "ctaLabel" TEXT,
ADD COLUMN "ctaHref" TEXT,
ADD COLUMN "secondaryCtaLabel" TEXT,
ADD COLUMN "secondaryCtaHref" TEXT,
ADD COLUMN "benefits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "howItWorks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "contentSections" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "status" "CategoryStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "showOnHomepage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showInNavigation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showInShop" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showLanding" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "ogImageUrl" TEXT,
ADD COLUMN "canonicalUrl" TEXT,
ADD COLUMN "indexable" BOOLEAN NOT NULL DEFAULT true;

UPDATE "ProductCategory"
SET "status" = CASE WHEN "active" THEN 'PUBLISHED'::"CategoryStatus" ELSE 'ARCHIVED'::"CategoryStatus" END;

UPDATE "ProductCategory" SET "slug" = 'child-safety-tags' WHERE "slug" = 'child-safety';
UPDATE "ProductCategory" SET "slug" = 'social-nfc-tags' WHERE "slug" = 'social';
UPDATE "ProductCategory" SET "slug" = 'business-nfc-tags' WHERE "slug" = 'business';
UPDATE "ProductCategory" SET "slug" = 'luggage-tags' WHERE "slug" = 'luggage';
UPDATE "ProductCategory" SET "status" = 'HIDDEN', "showOnHomepage" = false, "showInNavigation" = false, "showInShop" = false, "showLanding" = false WHERE "slug" = 'accessories';

ALTER TABLE "ProductCategory" DROP COLUMN "active";

ALTER TABLE "NFCTag"
ADD COLUMN "activationCodeVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "activationCodeRegeneratedAt" TIMESTAMP(3),
ADD COLUMN "activationLockedUntil" TIMESTAMP(3),
ADD COLUMN "orderItemId" UUID;

ALTER TABLE "StoreSettings" ALTER COLUMN "storeName" SET DEFAULT 'Tapkin';
ALTER TABLE "StoreSettings" ALTER COLUMN "siteTitle" SET DEFAULT 'Tapkin Smart Products';

UPDATE "StoreSettings"
SET "storeName" = 'Tapkin',
    "siteTitle" = CASE WHEN "siteTitle" = 'TapKind NFC' THEN 'Tapkin Smart Products' ELSE REPLACE("siteTitle", 'TapKind', 'Tapkin') END,
    "siteDescription" = CASE WHEN "siteDescription" = 'Smart NFC products designed and made in Australia.' THEN 'Personalised smart products combining 3D printing, NFC, QR and secure digital profiles.' ELSE REPLACE("siteDescription", 'TapKind', 'Tapkin') END;

UPDATE "Product" SET "brand" = 'Tapkin' WHERE LOWER("brand") = 'tapkind';

CREATE INDEX "ProductCategory_status_sortOrder_idx" ON "ProductCategory"("status", "sortOrder");
CREATE INDEX "ProductCategory_status_showOnHomepage_sortOrder_idx" ON "ProductCategory"("status", "showOnHomepage", "sortOrder");
CREATE INDEX "ProductCategory_status_showInNavigation_sortOrder_idx" ON "ProductCategory"("status", "showInNavigation", "sortOrder");
CREATE INDEX "ProductCategory_status_showInShop_sortOrder_idx" ON "ProductCategory"("status", "showInShop", "sortOrder");
CREATE INDEX "NFCTag_orderItemId_idx" ON "NFCTag"("orderItemId");

ALTER TABLE "NFCTag"
ADD CONSTRAINT "NFCTag_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
