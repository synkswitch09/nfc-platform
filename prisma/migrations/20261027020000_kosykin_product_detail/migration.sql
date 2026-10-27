ALTER TABLE "Product" ADD COLUMN "detailConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ProductCategory" ADD COLUMN "highlightColour" TEXT;
