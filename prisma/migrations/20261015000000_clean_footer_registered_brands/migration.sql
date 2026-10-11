-- One-time presentation update approved by the owner. Keep legal name, media,
-- provider settings, policies and FAQs. Later CMS edits remain authoritative.
DO $footer$
BEGIN
UPDATE "Store" SET
  organization = organization || jsonb_build_object('registeredBusinessName', CASE WHEN slug = 'kosykin' THEN 'Kosykin' ELSE 'Tapkin' END, 'abn', '84884117384'),
  "footerConfig" = "footerConfig" || jsonb_build_object(
    'includeManagedPages', false, 'termsLabel', 'Terms & Conditions', 'privacyLabel', 'Privacy Policy', 'showTerms', true, 'showPrivacy', true,
    'customLinks', '[{"id":"ba364e87-d62d-40d8-8f89-2933cdcc6c1a","label":"Help & Requests","href":"/support","visible":true,"order":0},{"id":"96636363-25d0-48bb-aa89-925124e53b02","label":"Frequently Asked Questions","href":"/faq","visible":true,"order":1}]'::jsonb,
    'policyLinks', CASE WHEN slug = 'kosykin' THEN '[{"id":"b31cdbdf-d202-466b-a0f9-116e92008b08","label":"Terms & Conditions","href":"/terms","visible":true,"order":0},{"id":"210358cb-b8d8-4948-b052-a352a219df56","label":"Shipping & Delivery","href":"/shipping-delivery","visible":true,"order":1},{"id":"e44a0d21-8dd5-4373-bb0c-4b54116b036d","label":"Returns & Cancellations","href":"/returns-cancellations","visible":true,"order":2},{"id":"266232e2-5c0e-4c5f-9708-bc7d3f2c135a","label":"Custom Designs","href":"/custom-designs","visible":true,"order":3},{"id":"be6e903c-148a-45ab-883b-ec35d0c65f3c","label":"Customer Points","href":"/customer-points","visible":true,"order":4}]'::jsonb
      ELSE '[{"id":"b31cdbdf-d202-466b-a0f9-116e92008b08","label":"Terms & Conditions","href":"/terms","visible":true,"order":0}]'::jsonb END),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE slug IN ('kosykin', 'tapkin');

-- Replace only the old editorial wording; never republish or replace CMS sections.
UPDATE "LandingPageSection" section SET content = jsonb_set(section.content, '{copy}', to_jsonb(replace(replace(replace(section.content->>'copy',
  'Kosykin is a homewares brand operated under Tapkin.', 'Kosykin is a registered homewares business name.'),
  'The legal seller and Australian Business Number are shown above.', 'The seller and Australian Business Number are listed under Seller information at the end of these terms.'),
  'Kosykin is operated under Tapkin.', 'Kosykin and Tapkin are registered business names operated by the same proprietor.'))), "updatedAt" = CURRENT_TIMESTAMP
FROM "ContentPage" page, "Store" store
WHERE section."pageId" = page.id AND page."storeId" = store.id AND store.slug = 'kosykin'
  AND (section.content->>'copy' LIKE '%Kosykin is a homewares brand operated under Tapkin.%' OR section.content->>'copy' LIKE '%Kosykin is operated under Tapkin.%');

UPDATE "LandingPageSection" section SET content = jsonb_set(section.content, '{items}', (
  SELECT jsonb_agg(CASE WHEN item->>'question' = 'What is Kosykin?' THEN jsonb_set(item, '{answer}', to_jsonb(replace(item->>'answer', 'Kosykin is a homewares brand operated under Tapkin.', 'Kosykin is a registered homewares business name.'))) ELSE item END ORDER BY ordinal)
  FROM jsonb_array_elements(section.content->'items') WITH ORDINALITY AS rows(item, ordinal)
)), "updatedAt" = CURRENT_TIMESTAMP
FROM "ContentPage" page, "Store" store
WHERE section."pageId" = page.id AND page."storeId" = store.id AND store.slug = 'kosykin' AND section.type = 'FAQ' AND jsonb_typeof(section.content->'items') = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(section.content->'items') item WHERE item->>'question' = 'What is Kosykin?' AND item->>'answer' LIKE '%Kosykin is a homewares brand operated under Tapkin.%');

END $footer$;
