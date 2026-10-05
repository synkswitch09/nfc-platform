-- Align the five Home collection cards with real shop filters in staging.
-- This data migration deliberately leaves development and production stores alone.
DO $$
DECLARE
  kosykin_id uuid;
  old_category_id uuid;
  collection record;
BEGIN
  IF current_database() <> 'tapkin_staging' THEN
    RETURN;
  END IF;

  SELECT "id" INTO kosykin_id FROM "Store" WHERE "slug" = 'kosykin';
  IF kosykin_id IS NULL THEN RETURN; END IF;

  SELECT p."categoryId" INTO old_category_id
  FROM "Product" p WHERE p."storeId" = kosykin_id AND p."slug" = 'custom-name-keychain';

  IF old_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Product" p WHERE p."categoryId" = old_category_id AND p."slug" <> 'custom-name-keychain'
  ) AND NOT EXISTS (
    SELECT 1 FROM "ProductCategory" c WHERE c."storeId" = kosykin_id AND c."slug" = 'personalised-pieces'
  ) THEN
    UPDATE "ProductCategory" SET "slug" = 'personalised-pieces', "name" = 'Personalised Pieces',
      "legacySlugs" = array_append("legacySlugs", "slug"), "status" = 'PUBLISHED',
      "showInShop" = true, "showInNavigation" = false, "showLanding" = false,
      "sortOrder" = 3, "ctaHref" = '/shop?category=personalised-pieces',
      "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = old_category_id;
    UPDATE "ContentPage" SET "slug" = 'personalised-pieces', "name" = 'Personalised Pieces',
      "status" = 'PUBLISHED', "sortOrder" = 3, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "categoryId" = old_category_id;
  END IF;

  FOR collection IN SELECT * FROM (VALUES
    ('stands-holders', 'Stands & Holders', 'Give your tech a happy home', 0),
    ('planters-vases', 'Planters & Vases', 'A little style for your leafy friends', 1),
    ('home-lighting', 'Home & Lighting', 'Bright ideas for cosy corners', 2),
    ('personalised-pieces', 'Personalised Pieces', 'Made with your personal twist', 3),
    ('seasonal-specials', 'Seasonal Specials', 'A Kosy touch for every occasion', 4)
  ) AS cards(slug, name, description, position) LOOP
    INSERT INTO "ProductCategory" ("id", "storeId", "slug", "name", "shortDescription", "status",
      "sortOrder", "showOnHomepage", "showInNavigation", "showInShop", "showLanding", "indexable", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), kosykin_id, collection.slug, collection.name, collection.description,
      'PUBLISHED', collection.position, true, false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("storeId", "slug") DO NOTHING;

    INSERT INTO "ContentPage" ("id", "storeId", "categoryId", "kind", "slug", "name", "status",
      "sortOrder", "indexable", "createdAt", "updatedAt")
    SELECT c."id", kosykin_id, c."id", 'CATEGORY', c."slug", c."name", c."status",
      c."sortOrder", false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "ProductCategory" c WHERE c."storeId" = kosykin_id AND c."slug" = collection.slug
    ON CONFLICT ("categoryId") DO NOTHING;
  END LOOP;

  UPDATE "Product" p SET "categoryId" = c."id", "updatedAt" = CURRENT_TIMESTAMP
  FROM "ProductCategory" c
  WHERE p."storeId" = kosykin_id AND p."slug" = 'custom-name-keychain'
    AND c."storeId" = kosykin_id AND c."slug" = 'personalised-pieces';

  -- The published Home sections retain their CMS images, wording and colours.
  UPDATE "LandingPageSection" section
  SET "content" = jsonb_set(section."content", '{items}', (
    SELECT jsonb_agg(
      CASE item->>'title'
        WHEN 'Stands & Holders' THEN item || '{"categorySlug":"stands-holders","ctaHref":"/shop?category=stands-holders"}'::jsonb
        WHEN 'Planters & Vases' THEN item || '{"categorySlug":"planters-vases","ctaHref":"/shop?category=planters-vases"}'::jsonb
        WHEN 'Home & Lighting' THEN item || '{"categorySlug":"home-lighting","ctaHref":"/shop?category=home-lighting"}'::jsonb
        WHEN 'Personalised Pieces' THEN item || '{"categorySlug":"personalised-pieces","ctaHref":"/shop?category=personalised-pieces"}'::jsonb
        WHEN 'Seasonal Specials' THEN item || '{"categorySlug":"seasonal-specials","ctaHref":"/shop?category=seasonal-specials"}'::jsonb
        ELSE item END ORDER BY position)
    FROM jsonb_array_elements(section."content"->'items') WITH ORDINALITY AS cards(item, position)
  )), "updatedAt" = CURRENT_TIMESTAMP
  FROM "ContentPage" page
  WHERE section."pageId" = page."id" AND page."storeId" = kosykin_id
    AND page."kind" = 'HOME' AND section."type" = 'FEATURE_BADGES'
    AND section."content"->>'layoutVariant' = 'KOSYKIN_CIRCLES'
    AND jsonb_typeof(section."content"->'items') = 'array';
END $$;
