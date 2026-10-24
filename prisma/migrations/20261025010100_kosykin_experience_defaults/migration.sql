-- Configure the requested launch once, without rewriting future CMS edits.
INSERT INTO "GiftCampaign" ("id", "storeId", "key", "name", "categoryId", "giftName", "limit", "awardedCount", "cycle", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", 'launch-stands', 'Launch gift', c."id", 'Wavy Mini Tray', 50, 0, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Store" s JOIN "ProductCategory" c ON c."storeId" = s."id" AND c."slug" = 'stands-holders'
WHERE s."slug" = 'kosykin'
ON CONFLICT ("storeId", "key") DO NOTHING;

INSERT INTO "StoreExperience" ("storeId", "config", "updatedAt")
SELECT s."id", jsonb_build_object(
  'reviewsEnabled', true, 'showExampleReviews', true, 'reviewsLimit', 3,
  'groups', jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text, 'name', 'Launch promotions', 'enabled', true,
    'home', true, 'homePosition', 3, 'shop', true, 'shopPosition', 'TOP',
    'slides', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'title', 'Launch gift',
      'description', 'Get a FREE {gift} when you buy any product from {category}.',
      'supportingText', 'First {limit} qualifying paid orders. One gift per order. Automatically included.',
      'visible', true, 'imageUrl', '', 'imageAlt', '', 'backgroundColour', '#b9afcf', 'textColour', '#243247',
      'ctaLabel', 'Explore the collection', 'ctaHref', '', 'campaignKey', 'launch-stands'
    ))
  ))
), CURRENT_TIMESTAMP FROM "Store" s WHERE s."slug" = 'kosykin'
ON CONFLICT ("storeId") DO NOTHING;

-- Global footer identity. Preserve configured URLs and uploaded icons. The
-- former per-page support overrides are removed in CSS.
UPDATE "Store" SET "footerConfig" = "footerConfig" || jsonb_build_object(
  'backgroundColour', '#243247', 'textColour', '#fbf6ed', 'linkColour', '#fbf6ed', 'logoTreatment', 'CREAM',
  'socialProfiles', CASE WHEN jsonb_typeof("footerConfig"->'socialProfiles') = 'array' THEN "footerConfig"->'socialProfiles' ELSE jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Instagram', 'href', COALESCE("socialLinks"->>'instagram', ''), 'iconUrl', COALESCE("footerConfig"->'socialIcons'->>'instagram', ''), 'visible', true, 'order', 0),
    jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Facebook', 'href', COALESCE("socialLinks"->>'facebook', ''), 'iconUrl', COALESCE("footerConfig"->'socialIcons'->>'facebook', ''), 'visible', true, 'order', 1)
  ) END
) WHERE "slug" = 'kosykin' AND NOT ("footerConfig" ? 'logoTreatment');

UPDATE "Store" s SET "footerConfig" = jsonb_set(s."footerConfig", '{socialProfiles}',
  COALESCE(s."footerConfig"->'socialProfiles', '[]'::jsonb) ||
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text,
    'label', CASE WHEN platform = 'instagram' THEN 'Instagram' ELSE 'Facebook' END,
    'href', COALESCE(s."socialLinks"->>platform, ''), 'iconUrl', '', 'visible', true, 'order', ordinal))
    FROM (VALUES ('instagram', 0), ('facebook', 1)) AS defaults(platform, ordinal)
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(s."footerConfig"->'socialProfiles', '[]'::jsonb)) profile WHERE lower(profile->>'label') = platform)), '[]'::jsonb))
WHERE s."slug" = 'kosykin';
