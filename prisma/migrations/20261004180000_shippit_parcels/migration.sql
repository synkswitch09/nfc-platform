ALTER TABLE "Shipment" ADD COLUMN "parcel" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "externalRequestAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "bookedAt" TIMESTAMP(3);
