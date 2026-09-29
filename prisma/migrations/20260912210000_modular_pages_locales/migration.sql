CREATE TYPE "ContentPageKind" AS ENUM ('HOME', 'CATEGORY', 'CAMPAIGN', 'COLLECTION', 'LEGAL');

ALTER TABLE "Store"
ADD COLUMN "headerConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "footerConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'en-AU',
ADD COLUMN "enabledLocales" TEXT[] NOT NULL DEFAULT ARRAY['en-AU']::TEXT[];

CREATE TABLE "ContentPage" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "categoryId" UUID,
    "kind" "ContentPageKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CategoryStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en-AU',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageUrl" TEXT,
    "canonicalUrl" TEXT,
    "indexable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPageTranslation" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentPageTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LandingPageSectionTranslation" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingPageSectionTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreLocale" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreLocale_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ContentPage" ("id", "storeId", "categoryId", "kind", "slug", "name", "status", "sortOrder", "defaultLocale", "seoTitle", "seoDescription", "ogImageUrl", "canonicalUrl", "indexable", "updatedAt")
SELECT "id", "storeId", "id", 'CATEGORY', "slug", "name", "status", "sortOrder", 'en-AU', "seoTitle", "seoDescription", "ogImageUrl", "canonicalUrl", "indexable", CURRENT_TIMESTAMP
FROM "ProductCategory";

INSERT INTO "ContentPage" ("id", "storeId", "kind", "slug", "name", "status", "sortOrder", "defaultLocale", "seoTitle", "seoDescription", "ogImageUrl", "indexable", "updatedAt")
SELECT (substr(md5("id"::text || ':home'), 1, 8) || '-' || substr(md5("id"::text || ':home'), 9, 4) || '-4' || substr(md5("id"::text || ':home'), 14, 3) || '-8' || substr(md5("id"::text || ':home'), 18, 3) || '-' || substr(md5("id"::text || ':home'), 21, 12))::uuid,
       "id", 'HOME', 'home', 'Home', CASE WHEN "status" = 'ACTIVE' THEN 'PUBLISHED'::"CategoryStatus" ELSE 'DRAFT'::"CategoryStatus" END, -1, 'en-AU', "seoTitle", "seoDescription", "socialImageUrl", true, CURRENT_TIMESTAMP
FROM "Store";

ALTER TABLE "LandingPageSection" ADD COLUMN "pageId" UUID;
UPDATE "LandingPageSection" SET "pageId" = "categoryId";
ALTER TABLE "LandingPageSection" ALTER COLUMN "pageId" SET NOT NULL;
ALTER TABLE "LandingPageSection" ALTER COLUMN "categoryId" DROP NOT NULL;

ALTER TABLE "CategoryImage"
ALTER COLUMN "categoryId" DROP NOT NULL,
ADD COLUMN "pageId" UUID,
ADD COLUMN "altText" TEXT,
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'content-image';
UPDATE "CategoryImage" SET "pageId" = "categoryId" WHERE "categoryId" IS NOT NULL;

CREATE UNIQUE INDEX "ContentPage_categoryId_key" ON "ContentPage"("categoryId");
CREATE UNIQUE INDEX "ContentPage_storeId_slug_key" ON "ContentPage"("storeId", "slug");
CREATE INDEX "ContentPage_storeId_kind_status_sortOrder_idx" ON "ContentPage"("storeId", "kind", "status", "sortOrder");
CREATE UNIQUE INDEX "ContentPageTranslation_pageId_locale_key" ON "ContentPageTranslation"("pageId", "locale");
CREATE INDEX "ContentPageTranslation_locale_idx" ON "ContentPageTranslation"("locale");
CREATE UNIQUE INDEX "LandingPageSectionTranslation_sectionId_locale_key" ON "LandingPageSectionTranslation"("sectionId", "locale");
CREATE INDEX "LandingPageSectionTranslation_locale_idx" ON "LandingPageSectionTranslation"("locale");
CREATE UNIQUE INDEX "StoreLocale_storeId_code_key" ON "StoreLocale"("storeId", "code");
CREATE INDEX "StoreLocale_storeId_active_sortOrder_idx" ON "StoreLocale"("storeId", "active", "sortOrder");
CREATE INDEX "LandingPageSection_storeId_pageId_visible_sortOrder_idx" ON "LandingPageSection"("storeId", "pageId", "visible", "sortOrder");
CREATE INDEX "CategoryImage_storeId_pageId_createdAt_idx" ON "CategoryImage"("storeId", "pageId", "createdAt");

ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentPageTranslation" ADD CONSTRAINT "ContentPageTranslation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandingPageSectionTranslation" ADD CONSTRAINT "LandingPageSectionTranslation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LandingPageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreLocale" ADD CONSTRAINT "StoreLocale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandingPageSection" ADD CONSTRAINT "LandingPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryImage" ADD CONSTRAINT "CategoryImage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
