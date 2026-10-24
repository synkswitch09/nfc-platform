-- Enable the requested launch banner and clearly labelled demonstration testimonials.
-- Preserve existing authored slides/reviews, section identities and tenant isolation.
DO $migration$
DECLARE module jsonb;
BEGIN
 FOR module IN SELECT value FROM jsonb_array_elements($modules$[{"type":"CTA_BANNER","name":"Kosykin · Launch promotions","visible":true,"content":{"layoutVariant":"KOSYKIN_PROMOTIONS","headline":"Launch gift","copy":"Get a FREE Wavy Mini Tray when you buy any Wavy Stand.","items":[{"id":"c7402d69-2aec-4aa2-a573-5d96c659ba3b","title":"Launch gift","description":"Get a FREE Wavy Mini Tray when you buy any Wavy Stand.","supportingText":"First 50 qualifying orders. One gift per order, packed with your purchase.","ctaLabel":"Explore the collection","ctaHref":"/shop?category=stands-holders","visible":true,"order":0}],"ctaLabel":"Explore the collection","ctaHref":"/shop","backgroundColour":"#b9afcf"}},{"type":"FEATURE_BADGES","name":"Kosykin · Customer stories","visible":true,"content":{"layoutVariant":"KOSYKIN_REVIEWS","headline":"Made For Real Spaces. Loved In Real Life.","copy":"Example reviews for layout preview — these are not real customer testimonials.","items":[{"id":"29a0864a-da7c-44c7-a1eb-742a68f03da9","title":"Example review 01","description":"A playful little detail that makes an everyday desk feel more personal.","supportingText":"Illustrative text · not a customer review","visible":true,"order":0},{"id":"b1756fb8-bd3d-42e7-871d-90f279c2e7ed","title":"Example review 02","description":"Practical shapes, soft colours and a cosy spot for the things I use every day.","supportingText":"Illustrative text · not a customer review","visible":true,"order":1},{"id":"f0eee8ea-d8c1-4aa4-97c9-8e4db72d198a","title":"Example review 03","description":"A thoughtful gift idea with room for a personal touch.","supportingText":"Illustrative text · not a customer review","visible":true,"order":2}]}}]$modules$::jsonb)
 LOOP
  UPDATE "LandingPageSection" section
  SET "visible" = true,
      "content" = CASE WHEN jsonb_array_length(CASE WHEN jsonb_typeof(section."content"->'items') = 'array' THEN section."content"->'items' ELSE '[]'::jsonb END) = 0
        THEN module->'content' || section."content" || jsonb_build_object('items',module->'content'->'items') || CASE WHEN module->'content'->>'layoutVariant' = 'KOSYKIN_REVIEWS' THEN jsonb_build_object('copy',module->'content'->'copy') ELSE '{}'::jsonb END
        ELSE section."content" END,
      "updatedAt" = CURRENT_TIMESTAMP
  FROM "ContentPage" page JOIN "Store" store ON store."id" = page."storeId"
  WHERE section."pageId" = page."id" AND store."slug" = 'kosykin' AND page."kind" = 'HOME'
    AND section."content"->>'layoutVariant' = module->'content'->>'layoutVariant';
 END LOOP;
END $migration$;
