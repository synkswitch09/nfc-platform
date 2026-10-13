-- Owner-authorised opt-out model. Patch only tracking paragraphs/items in the
-- two stores' existing CMS content; preserve sections, styling and unrelated edits.
DO $tracking_notice$
DECLARE
  row_record record;
  new_copy text;
  new_items jsonb;
BEGIN
  FOR row_record IN
    SELECT section.id, section.content, page.slug
    FROM "LandingPageSection" section
    JOIN "ContentPage" page ON page.id = section."pageId" AND page."storeId" = section."storeId"
    JOIN "Store" store ON store.id = section."storeId"
    WHERE store.slug IN ('tapkin', 'kosykin') AND page.slug IN ('privacy', 'faq')
  LOOP
    IF row_record.slug = 'privacy' AND jsonb_typeof(row_record.content->'copy') = 'string' THEN
      new_copy := row_record.content->>'copy';
      new_copy := replace(new_copy, 'consented measurement services', 'measurement services subject to your privacy settings');
      new_copy := replace(new_copy, 'receives consented shopping and website events', 'receives shopping and website events unless you disable analytics');
      new_copy := replace(new_copy, 'may record consented, anonymous browsing', 'may record anonymous browsing unless you disable analytics');
      new_copy := replace(new_copy, 'These tools remain inactive when not configured or enabled and require analytics consent.',
        'Configured analytics tools are active by default for new visitors. The first-visit notice explains this and offers an immediate opt-out. Use Privacy & cookie settings to disable analytics at any time. Existing saved opt-outs are respected. These tools remain inactive when not configured or enabled. Google explains its processing at https://policies.google.com/technologies/partner-sites.');
      new_copy := replace(new_copy, 'If enabled and you allow advertising measurement,', 'If configured and enabled, and unless you disable advertising measurement,');
      new_copy := replace(new_copy, 'Use Privacy & cookie settings to allow or decline optional analytics and advertising or change your choice later.',
        'Configured analytics and advertising measurement are active by default for new visitors. A first-visit notice provides an immediate option to disable either category or all optional tracking. Use Privacy & cookie settings to change these settings at any time; your previously saved choices remain respected. Preferences are stored in a store-specific browser cookie for up to one year. These settings do not enable a provider that has not been configured or switched on for the store.');
      IF new_copy IS DISTINCT FROM row_record.content->>'copy' THEN
        UPDATE "LandingPageSection" SET content = jsonb_set(content, '{copy}', to_jsonb(new_copy)), "updatedAt" = CURRENT_TIMESTAMP WHERE id = row_record.id;
      END IF;
    ELSIF row_record.slug = 'faq' AND jsonb_typeof(row_record.content->'items') = 'array' THEN
      SELECT jsonb_agg(CASE WHEN item->>'question' = 'Can I decline analytics and advertising tracking?'
          AND item->>'answer' LIKE '%relevant consent has been given%'
        THEN jsonb_set(item, '{answer}', to_jsonb('Yes. Configured analytics and advertising measurement are active by default for new visitors. Use the first-visit notice or Privacy & cookie settings to disable either category or all optional tracking. Your saved choices are respected. Disabling tracking does not prevent buying or getting support. Providers remain inactive until configured and enabled.'::text))
        ELSE item END ORDER BY ordinality)
      INTO new_items FROM jsonb_array_elements(row_record.content->'items') WITH ORDINALITY AS entries(item, ordinality);
      IF new_items IS DISTINCT FROM row_record.content->'items' THEN
        UPDATE "LandingPageSection" SET content = jsonb_set(content, '{items}', new_items), "updatedAt" = CURRENT_TIMESTAMP WHERE id = row_record.id;
      END IF;
    END IF;
  END LOOP;
END $tracking_notice$;
