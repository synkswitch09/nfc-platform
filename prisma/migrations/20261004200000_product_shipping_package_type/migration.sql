CREATE TYPE "ShippingPackageType" AS ENUM ('BOX', 'MAILER');
ALTER TABLE "Product" ADD COLUMN "shippingPackageType" "ShippingPackageType" NOT NULL DEFAULT 'BOX';
INSERT INTO "Packaging" ("id", "storeId", "name", "code", "lengthMm", "widthMm", "heightMm", "emptyWeightGrams", "costCents", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", p."name", p."code", p."lengthMm", p."widthMm", p."heightMm", 0, 0, true, NOW(), NOW()
FROM "Store" s CROSS JOIN (VALUES
  ('UNIT-BOX-27X16X12', 'Single product box · 27 × 16 × 12 cm', 270, 160, 120),
  ('UNIT-BOX-15X12X9', 'Single product box · 15 × 12 × 9 cm', 150, 120, 90),
  ('OUTER-BOX-30X25X25', 'Outer shipping box · 30 × 25 × 25 cm', 300, 250, 250),
  ('MAILER-25X15', 'Shipping bag · 25 × 15 cm', 250, 150, 0)
) AS p("code", "name", "lengthMm", "widthMm", "heightMm")
ON CONFLICT ("storeId", "code") DO NOTHING;
UPDATE "Product" p SET "shippingPackageType" = 'MAILER', "defaultPackagingId" = k."id"
FROM "Packaging" k WHERE p."storeId" = k."storeId" AND p."slug" = 'custom-name-keychain' AND k."code" = 'MAILER-25X15';
