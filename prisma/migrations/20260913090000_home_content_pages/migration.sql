CREATE UNIQUE INDEX "ContentPage_one_home_per_store"
ON "ContentPage" ("storeId")
WHERE "kind" = 'HOME';

INSERT INTO "ContentPage" (
  "id", "storeId", "kind", "slug", "name", "status", "sortOrder", "defaultLocale",
  "seoTitle", "seoDescription", "ogImageUrl", "indexable", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), s."id", 'HOME', 'home', 'Home',
  CASE WHEN s."status" = 'ACTIVE' THEN 'PUBLISHED'::"CategoryStatus" ELSE 'DRAFT'::"CategoryStatus" END,
  0, s."defaultLocale", s."seoTitle", s."seoDescription", s."socialImageUrl", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Store" s
WHERE NOT EXISTS (
  SELECT 1 FROM "ContentPage" p WHERE p."storeId" = s."id" AND p."kind" = 'HOME'
);
