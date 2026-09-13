ALTER TABLE "Address"
  ADD COLUMN "company" TEXT,
  ADD COLUMN "locality" TEXT,
  ADD COLUMN "dependentLocality" TEXT,
  ADD COLUMN "administrativeArea" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "formattedAddress" TEXT;

UPDATE "Address"
SET "locality" = "suburb", "administrativeArea" = "state";

ALTER TABLE "Address"
  ALTER COLUMN "locality" SET NOT NULL,
  ALTER COLUMN "suburb" DROP NOT NULL,
  ALTER COLUMN "state" DROP NOT NULL;

ALTER TABLE "Order"
  ADD COLUMN "shippingCompany" TEXT,
  ADD COLUMN "shippingLocality" TEXT,
  ADD COLUMN "shippingDependentLocality" TEXT,
  ADD COLUMN "shippingAdministrativeArea" TEXT,
  ADD COLUMN "shippingPhone" TEXT,
  ADD COLUMN "shippingFormattedAddress" TEXT;

UPDATE "Order"
SET "shippingLocality" = "shippingSuburb",
    "shippingAdministrativeArea" = "shippingState";

CREATE TYPE "CustomsDutiesHandling" AS ENUM ('UNDETERMINED', 'RECIPIENT_PAYS', 'SENDER_PAYS');

ALTER TABLE "Product"
  ADD COLUMN "countryOfOrigin" TEXT,
  ADD COLUMN "customsDescription" TEXT,
  ADD COLUMN "hsCode" TEXT,
  ADD COLUMN "customsValueCents" INTEGER,
  ADD COLUMN "dutiesHandling" "CustomsDutiesHandling" NOT NULL DEFAULT 'UNDETERMINED',
  ADD COLUMN "restrictedItem" BOOLEAN NOT NULL DEFAULT false;
