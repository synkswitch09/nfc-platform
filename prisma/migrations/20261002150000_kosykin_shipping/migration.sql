-- Bootstrap only the missing Kosykin shipping records. Existing store rates and
-- origins remain the source of truth when they are already active.
DO $$
DECLARE
  target_store UUID;
  parcel_id UUID;
  australia_zone_id UUID;
  manual_provider_id UUID;
BEGIN
  SELECT "id" INTO target_store FROM "Store" WHERE "slug" = 'kosykin';
  IF target_store IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "ShippingOrigin" WHERE "storeId" = target_store AND "active") THEN
    INSERT INTO "ShippingOrigin" (
      "id", "storeId", "name", "senderName", "company", "line1", "suburb",
      "state", "postcode", "country", "isDefault", "active", "updatedAt"
    ) VALUES (
      gen_random_uuid(), target_store, 'Primary dispatch', 'Kosykin', 'Kosykin',
      'Configure before live fulfilment', 'Adelaide', 'SA', '5000', 'AU', true, true, CURRENT_TIMESTAMP
    ) ON CONFLICT ("storeId", "name") DO UPDATE
      SET "active" = true, "isDefault" = true, "updatedAt" = CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Packaging" WHERE "storeId" = target_store AND "active") THEN
    INSERT INTO "Packaging" (
      "id", "storeId", "name", "code", "lengthMm", "widthMm", "heightMm",
      "emptyWeightGrams", "maxWeightGrams", "active", "updatedAt"
    ) VALUES (
      gen_random_uuid(), target_store, 'Small recyclable parcel', 'SMALL-PARCEL',
      220, 160, 60, 80, 5000, true, CURRENT_TIMESTAMP
    ) ON CONFLICT ("storeId", "code") DO UPDATE
      SET "active" = true, "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
  SELECT "id" INTO parcel_id FROM "Packaging"
    WHERE "storeId" = target_store AND "active"
    ORDER BY "createdAt" ASC LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM "ShippingZone" WHERE "storeId" = target_store AND "active" AND 'AU' = ANY("countries")) THEN
    INSERT INTO "ShippingZone" (
      "id", "storeId", "name", "countries", "states", "postcodeRules", "active", "updatedAt"
    ) VALUES (
      gen_random_uuid(), target_store, 'Australia', ARRAY['AU']::TEXT[],
      ARRAY[]::TEXT[], '[]'::JSONB, true, CURRENT_TIMESTAMP
    ) ON CONFLICT ("storeId", "name") DO UPDATE
      SET "active" = true, "countries" = ARRAY['AU']::TEXT[],
          "states" = ARRAY[]::TEXT[], "postcodeRules" = '[]'::JSONB,
          "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
  SELECT "id" INTO australia_zone_id FROM "ShippingZone"
    WHERE "storeId" = target_store AND "active" AND 'AU' = ANY("countries")
      AND cardinality("states") = 0
    ORDER BY "priority" DESC, "createdAt" ASC LIMIT 1;

  IF australia_zone_id IS NULL THEN
    RETURN; -- A deliberately restricted zone must retain its existing policy.
  END IF;
  IF EXISTS (SELECT 1 FROM "ShippingRate" WHERE "storeId" = target_store AND "zoneId" = australia_zone_id AND "active") THEN
    RETURN;
  END IF;

  INSERT INTO "ShippingProvider" (
    "id", "storeId", "key", "name", "kind", "active", "supportsRates", "supportsLabels", "updatedAt"
  ) VALUES (
    gen_random_uuid(), target_store, 'manual', 'Manual fallback', 'MANUAL', true, true, false, CURRENT_TIMESTAMP
  ) ON CONFLICT ("storeId", "key") DO UPDATE
    SET "active" = true, "supportsRates" = true, "updatedAt" = CURRENT_TIMESTAMP;
  SELECT "id" INTO manual_provider_id FROM "ShippingProvider"
    WHERE "storeId" = target_store AND "key" = 'manual';

  INSERT INTO "ShippingRate" (
    "id", "storeId", "zoneId", "providerId", "packagingId", "serviceCode",
    "serviceName", "amountCents", "freeOverCents", "estimatedDaysMin",
    "estimatedDaysMax", "active", "updatedAt"
  ) VALUES (
    gen_random_uuid(), target_store, australia_zone_id, manual_provider_id, parcel_id,
    'STANDARD', 'Standard parcel delivery', 900, 6000, 2, 6, true, CURRENT_TIMESTAMP
  ) ON CONFLICT ("storeId", "zoneId", "serviceCode", "packagingId") DO UPDATE
    SET "active" = true, "providerId" = EXCLUDED."providerId", "updatedAt" = CURRENT_TIMESTAMP;
END $$;
