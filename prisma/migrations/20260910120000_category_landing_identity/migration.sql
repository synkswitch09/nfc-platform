CREATE TYPE "CategoryVisualTheme" AS ENUM ('CORAL', 'SKY', 'MIDNIGHT', 'VIOLET', 'AMBER');
CREATE TYPE "CategoryLandingLayout" AS ENUM ('EDITORIAL', 'ASSURANCE', 'EXECUTIVE', 'MOMENTUM', 'JOURNEY');

ALTER TABLE "ProductCategory"
ADD COLUMN "legacySlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "cardImageAlt" TEXT,
ADD COLUMN "heroImageAlt" TEXT,
ADD COLUMN "useCases" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "finalCtaEyebrow" TEXT,
ADD COLUMN "finalCtaHeadline" TEXT,
ADD COLUMN "finalCtaDescription" TEXT,
ADD COLUMN "finalCtaLabel" TEXT,
ADD COLUMN "finalCtaHref" TEXT,
ADD COLUMN "visualTheme" "CategoryVisualTheme" NOT NULL DEFAULT 'CORAL',
ADD COLUMN "landingLayout" "CategoryLandingLayout" NOT NULL DEFAULT 'EDITORIAL';

UPDATE "ProductCategory" SET "legacySlugs" = ARRAY['pet-tags'], "slug" = 'pet', "name" = 'Pet', "visualTheme" = 'CORAL', "landingLayout" = 'EDITORIAL' WHERE "slug" = 'pet-tags';
UPDATE "ProductCategory" SET "legacySlugs" = ARRAY['child-safety-tags'], "slug" = 'child', "name" = 'Child', "visualTheme" = 'SKY', "landingLayout" = 'ASSURANCE' WHERE "slug" = 'child-safety-tags';
UPDATE "ProductCategory" SET "legacySlugs" = ARRAY['business-nfc-tags'], "slug" = 'business', "name" = 'Business', "visualTheme" = 'MIDNIGHT', "landingLayout" = 'EXECUTIVE' WHERE "slug" = 'business-nfc-tags';
UPDATE "ProductCategory" SET "legacySlugs" = ARRAY['social-nfc-tags'], "slug" = 'social-media', "name" = 'Social Media', "visualTheme" = 'VIOLET', "landingLayout" = 'MOMENTUM' WHERE "slug" = 'social-nfc-tags';
UPDATE "ProductCategory" SET "legacySlugs" = ARRAY['luggage-tags'], "slug" = 'luggage', "name" = 'Luggage', "visualTheme" = 'AMBER', "landingLayout" = 'JOURNEY' WHERE "slug" = 'luggage-tags';

CREATE INDEX "ProductCategory_legacySlugs_idx" ON "ProductCategory" USING GIN ("legacySlugs");
