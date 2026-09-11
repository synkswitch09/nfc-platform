CREATE TYPE "PersonalisationMode" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');
CREATE TYPE "ShippingProviderKind" AS ENUM ('MANUAL', 'MOCK', 'AUSTRALIA_POST');
CREATE TYPE "ShippingQuoteStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED');
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'LABEL_READY', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
CREATE TYPE "PrintDocumentType" AS ENUM ('SHIPPING_LABEL');
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'PRINTED', 'FAILED', 'CANCELLED');
CREATE TYPE "LandingSectionType" AS ENUM ('HERO', 'FEATURE_BADGES', 'BENEFITS', 'STEPS', 'PRODUCT_SHOWCASE', 'FEATURE_LIST', 'MEDIA_CONTENT', 'STORY_PROCESS', 'FAQ', 'CTA_BANNER', 'PRODUCT_GRID', 'CATEGORY_GRID', 'RICH_TEXT', 'TRUST_STRIP', 'STATS');

CREATE TABLE "ShippingOrigin" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "company" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "suburb" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "postcode" TEXT NOT NULL,
  "country" CHAR(2) NOT NULL DEFAULT 'AU',
  "phone" TEXT,
  "email" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingOrigin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Packaging" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "lengthMm" INTEGER NOT NULL,
  "widthMm" INTEGER NOT NULL,
  "heightMm" INTEGER NOT NULL,
  "emptyWeightGrams" INTEGER NOT NULL DEFAULT 0,
  "maxWeightGrams" INTEGER,
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Packaging_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingZone" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "countries" TEXT[] DEFAULT ARRAY['AU']::TEXT[],
  "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "postcodeRules" JSONB NOT NULL DEFAULT '[]',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingProvider" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "ShippingProviderKind" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "supportsRates" BOOLEAN NOT NULL DEFAULT false,
  "supportsLabels" BOOLEAN NOT NULL DEFAULT false,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingRate" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "zoneId" UUID NOT NULL,
  "providerId" UUID,
  "packagingId" UUID,
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "freeOverCents" INTEGER,
  "minWeightGrams" INTEGER,
  "maxWeightGrams" INTEGER,
  "estimatedDaysMin" INTEGER,
  "estimatedDaysMax" INTEGER,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingQuote" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "ShippingQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
  "cartHash" TEXT NOT NULL,
  "destinationHash" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'AUD',
  "estimatedDaysMin" INTEGER,
  "estimatedDaysMax" INTEGER,
  "originSnapshot" JSONB NOT NULL,
  "packagingSnapshot" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShippingQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shipment" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "originId" UUID,
  "providerId" UUID,
  "providerShipmentId" TEXT,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "trackingNumber" TEXT,
  "trackingUrl" TEXT,
  "labelStorageKey" TEXT,
  "labelMimeType" TEXT,
  "labelCreatedAt" TIMESTAMP(3),
  "createdById" UUID,
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintAgent" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "printerName" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrintAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintJob" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "shipmentId" UUID NOT NULL,
  "printAgentId" UUID,
  "documentType" "PrintDocumentType" NOT NULL DEFAULT 'SHIPPING_LABEL',
  "status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
  "copies" INTEGER NOT NULL DEFAULT 1,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseTokenHash" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "printedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LandingPageSection" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "type" "LandingSectionType" NOT NULL,
  "name" TEXT NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "content" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LandingPageSection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "personalisationMode" "PersonalisationMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "lengthMm" INTEGER,
ADD COLUMN "widthMm" INTEGER,
ADD COLUMN "heightMm" INTEGER,
ADD COLUMN "defaultPackagingId" UUID,
ADD COLUMN "shipsSeparately" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "specialHandling" TEXT;

ALTER TABLE "ProductVariant" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "optionSelection" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "lengthMm" INTEGER,
ADD COLUMN "widthMm" INTEGER,
ADD COLUMN "heightMm" INTEGER,
ADD COLUMN "defaultPackagingId" UUID;

ALTER TABLE "ProductImage" ADD COLUMN "optionValueId" UUID;
ALTER TABLE "ProductOptionValue" ADD COLUMN "swatchHex" TEXT,
ADD COLUMN "swatchHexSecondary" TEXT,
ADD COLUMN "swatchImageUrl" TEXT;

ALTER TABLE "Order" ADD COLUMN "shippingProviderKey" TEXT,
ADD COLUMN "shippingServiceCode" TEXT,
ADD COLUMN "shippingServiceName" TEXT,
ADD COLUMN "shippingQuoteId" UUID,
ADD COLUMN "shippingQuoteSnapshot" JSONB,
ADD COLUMN "packagingSnapshot" JSONB,
ADD COLUMN "shippingOriginSnapshot" JSONB;

ALTER TABLE "OrderItem" ADD COLUMN "personalisationMode" "PersonalisationMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN "selectedOptions" JSONB,
ADD COLUMN "shippingSnapshot" JSONB;

CREATE UNIQUE INDEX "ShippingOrigin_storeId_name_key" ON "ShippingOrigin"("storeId", "name");
CREATE INDEX "ShippingOrigin_storeId_active_isDefault_idx" ON "ShippingOrigin"("storeId", "active", "isDefault");
CREATE UNIQUE INDEX "Packaging_storeId_code_key" ON "Packaging"("storeId", "code");
CREATE INDEX "Packaging_storeId_active_name_idx" ON "Packaging"("storeId", "active", "name");
CREATE UNIQUE INDEX "ShippingZone_storeId_name_key" ON "ShippingZone"("storeId", "name");
CREATE INDEX "ShippingZone_storeId_active_priority_idx" ON "ShippingZone"("storeId", "active", "priority");
CREATE UNIQUE INDEX "ShippingProvider_storeId_key_key" ON "ShippingProvider"("storeId", "key");
CREATE INDEX "ShippingProvider_storeId_active_idx" ON "ShippingProvider"("storeId", "active");
CREATE UNIQUE INDEX "ShippingRate_storeId_zoneId_serviceCode_packagingId_key" ON "ShippingRate"("storeId", "zoneId", "serviceCode", "packagingId");
CREATE INDEX "ShippingRate_storeId_active_priority_idx" ON "ShippingRate"("storeId", "active", "priority");
CREATE INDEX "ShippingRate_zoneId_active_idx" ON "ShippingRate"("zoneId", "active");
CREATE UNIQUE INDEX "ShippingQuote_tokenHash_key" ON "ShippingQuote"("tokenHash");
CREATE INDEX "ShippingQuote_storeId_status_expiresAt_idx" ON "ShippingQuote"("storeId", "status", "expiresAt");
CREATE INDEX "Shipment_storeId_status_createdAt_idx" ON "Shipment"("storeId", "status", "createdAt");
CREATE INDEX "Shipment_orderId_createdAt_idx" ON "Shipment"("orderId", "createdAt");
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");
CREATE UNIQUE INDEX "PrintAgent_tokenHash_key" ON "PrintAgent"("tokenHash");
CREATE UNIQUE INDEX "PrintAgent_storeId_name_key" ON "PrintAgent"("storeId", "name");
CREATE INDEX "PrintAgent_storeId_active_idx" ON "PrintAgent"("storeId", "active");
CREATE INDEX "PrintJob_storeId_status_createdAt_idx" ON "PrintJob"("storeId", "status", "createdAt");
CREATE INDEX "PrintJob_printAgentId_status_idx" ON "PrintJob"("printAgentId", "status");
CREATE INDEX "PrintJob_leaseExpiresAt_idx" ON "PrintJob"("leaseExpiresAt");
CREATE INDEX "LandingPageSection_storeId_categoryId_visible_sortOrder_idx" ON "LandingPageSection"("storeId", "categoryId", "visible", "sortOrder");
CREATE INDEX "ProductImage_productId_optionValueId_sortOrder_idx" ON "ProductImage"("productId", "optionValueId", "sortOrder");
CREATE UNIQUE INDEX "Order_shippingQuoteId_key" ON "Order"("shippingQuoteId");

ALTER TABLE "ShippingOrigin" ADD CONSTRAINT "ShippingOrigin_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingOrigin" ADD CONSTRAINT "ShippingOrigin_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Packaging" ADD CONSTRAINT "Packaging_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingZone" ADD CONSTRAINT "ShippingZone_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingProvider" ADD CONSTRAINT "ShippingProvider_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originId_fkey" FOREIGN KEY ("originId") REFERENCES "ShippingOrigin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintAgent" ADD CONSTRAINT "PrintAgent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintAgent" ADD CONSTRAINT "PrintAgent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_printAgentId_fkey" FOREIGN KEY ("printAgentId") REFERENCES "PrintAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LandingPageSection" ADD CONSTRAINT "LandingPageSection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LandingPageSection" ADD CONSTRAINT "LandingPageSection_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultPackagingId_fkey" FOREIGN KEY ("defaultPackagingId") REFERENCES "Packaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_defaultPackagingId_fkey" FOREIGN KEY ("defaultPackagingId") REFERENCES "Packaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingQuoteId_fkey" FOREIGN KEY ("shippingQuoteId") REFERENCES "ShippingQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
