-- Create the second brand only in the staging database. No catalog or orders are copied.
-- A draft remains offline for commerce while DNS, HTTPS, content and contact details are reviewed.
DO $$
DECLARE
  target_id UUID;
BEGIN
  IF current_database() <> 'tapkin_staging' THEN
    RETURN;
  END IF;

  INSERT INTO "Store" (
    "id", "slug", "name", "displayName", "status", "seoTitle", "seoDescription",
    "homepage", "organization", "capabilities", "updatedAt"
  ) VALUES (
    '00000000-0000-4000-8000-000000000003', 'kosykin', 'Kosykin', 'Kosykin',
    'DRAFT', 'Kosykin', 'Explore products from Kosykin.',
    '{"variant":"editorial","heroEyebrow":"Kosykin","heroHeadline":"Welcome to Kosykin","heroDescription":"Discover products from Kosykin.","primaryCtaLabel":"Shop products","primaryCtaHref":"/shop"}'::jsonb,
    '{"type":"Organization","name":"Kosykin"}'::jsonb,
    ARRAY['COMMERCE', 'PRINT_3D', 'INVENTORY']::"StoreCapability"[], CURRENT_TIMESTAMP
  ) ON CONFLICT ("slug") DO NOTHING;

  SELECT "id" INTO target_id FROM "Store" WHERE "slug" = 'kosykin';
  INSERT INTO "StoreDomain" (
    "id", "storeId", "environment", "hostname", "protocol", "isPrimary", "updatedAt"
  ) VALUES (
    '00000000-0000-4000-8100-000000000007', target_id, 'STAGING',
    'staging.kosykin.com.au', 'https', true, CURRENT_TIMESTAMP
  ) ON CONFLICT ("environment", "hostname") DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM "StoreDomain"
    WHERE "environment" = 'STAGING' AND "hostname" = 'staging.kosykin.com.au'
      AND "storeId" = target_id
  ) THEN
    RAISE EXCEPTION 'staging.kosykin.com.au is already assigned to another store';
  END IF;
END $$;
