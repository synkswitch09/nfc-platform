-- Provision Kosykin only in the dedicated production database.
-- No customers, products, tags or orders are copied from another environment.
DO $$
DECLARE
  target_id UUID;
BEGIN
  IF current_database() <> 'tapkin_production' THEN
    RETURN;
  END IF;

  INSERT INTO "Store" (
    "id", "slug", "name", "displayName", "status", "seoTitle", "seoDescription",
    "homepage", "organization", "capabilities", "updatedAt"
  ) VALUES (
    '00000000-0000-4000-8000-000000000003', 'kosykin', 'Kosykin', 'Kosykin',
    'ACTIVE', 'Kosykin', 'Explore products from Kosykin.',
    '{"variant":"editorial","heroEyebrow":"Kosykin","heroHeadline":"Welcome to Kosykin","heroDescription":"Discover products from Kosykin.","primaryCtaLabel":"Shop products","primaryCtaHref":"/shop"}'::jsonb,
    '{"type":"Organization","name":"Kosykin"}'::jsonb,
    ARRAY['COMMERCE', 'PRINT_3D', 'INVENTORY']::"StoreCapability"[], CURRENT_TIMESTAMP
  ) ON CONFLICT ("slug") DO NOTHING;

  SELECT "id" INTO target_id FROM "Store" WHERE "slug" = 'kosykin';
  IF target_id IS NULL THEN RAISE EXCEPTION 'Kosykin store could not be created'; END IF;

  INSERT INTO "StoreDomain" (
    "id", "storeId", "environment", "hostname", "protocol", "isPrimary", "updatedAt"
  ) VALUES (
    '00000000-0000-4000-8100-000000000008', target_id, 'PRODUCTION',
    'kosykin.com.au', 'https', true, CURRENT_TIMESTAMP
  ) ON CONFLICT ("environment", "hostname") DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM "StoreDomain" WHERE "environment" = 'PRODUCTION'
      AND "hostname" = 'kosykin.com.au' AND "storeId" = target_id
  ) THEN
    RAISE EXCEPTION 'kosykin.com.au is assigned to another store';
  END IF;
END $$;
