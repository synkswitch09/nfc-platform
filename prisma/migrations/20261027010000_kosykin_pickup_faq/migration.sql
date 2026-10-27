-- Add the owner's local-pickup FAQ without replacing existing CMS content.
DO $pickup_faq$
DECLARE
  target record;
  position integer;
  question text := 'Can I pick up my order from Parafield Gardens?';
  answer text := 'Yes! Select Local pickup at checkout to collect your order from Parafield Gardens, South Australia, with no shipping charge. We will email you when your order is ready, along with the collection address and instructions for arranging a pickup time. Please wait for this email before coming to collect. Made-to-order items still need their usual production time.';
BEGIN
  FOR target IN
    SELECT page.id, page."storeId"
    FROM "ContentPage" page JOIN "Store" store ON store.id = page."storeId"
    WHERE store.slug = 'kosykin' AND page.slug = 'faq'
  LOOP
    IF EXISTS (
      SELECT 1 FROM "LandingPageSection" section,
        LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(section.content->'items') = 'array' THEN section.content->'items' ELSE '[]'::jsonb END) item
      WHERE section."pageId" = target.id AND section."storeId" = target."storeId" AND section.type = 'FAQ'
        AND (item->>'id' = '40b26d4f-4614-43e4-bb1a-aa3e98586921' OR lower(item->>'question') = lower(question))
    ) THEN CONTINUE; END IF;
    SELECT COALESCE(max("sortOrder") + 1, 0) INTO position FROM "LandingPageSection" WHERE "pageId" = target.id;
    INSERT INTO "LandingPageSection" (id, "storeId", "pageId", type, name, visible, "sortOrder", content, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), target."storeId", target.id, 'FAQ', 'Local pickup', true, position,
      jsonb_build_object('headline', 'Local pickup', 'items', jsonb_build_array(jsonb_build_object(
        'id', '40b26d4f-4614-43e4-bb1a-aa3e98586921', 'question', question, 'answer', answer, 'visible', true, 'order', 0))),
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END LOOP;
END $pickup_faq$;
