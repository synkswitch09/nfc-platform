ALTER TABLE "Product" ADD COLUMN "legacySlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ContentPage" ADD COLUMN "legacySlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Product_legacySlugs_idx" ON "Product" USING GIN ("legacySlugs");
CREATE INDEX "ContentPage_legacySlugs_idx" ON "ContentPage" USING GIN ("legacySlugs");
