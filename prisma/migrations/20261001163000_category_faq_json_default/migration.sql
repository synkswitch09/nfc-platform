-- ProductCategory.faq is required JSON in Prisma, but the original database
-- column was nullable and lacked a database default for raw SQL inserts.
UPDATE "ProductCategory" SET "faq" = '[]'::jsonb WHERE "faq" IS NULL;
ALTER TABLE "ProductCategory" ALTER COLUMN "faq" SET DEFAULT '[]'::jsonb;
ALTER TABLE "ProductCategory" ALTER COLUMN "faq" SET NOT NULL;
