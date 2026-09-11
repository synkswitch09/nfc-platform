-- A product's display brand must be chosen in the trusted Store context.
-- Keeping a Tapkin default here could silently misbrand products created for another Store.
ALTER TABLE "Product" ALTER COLUMN "brand" DROP DEFAULT;
