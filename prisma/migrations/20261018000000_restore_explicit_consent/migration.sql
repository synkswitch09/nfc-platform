-- Restore affirmative consent. Existing default grants cannot authorise server deliveries.
ALTER TABLE "MeasurementSession" ADD COLUMN IF NOT EXISTS "consentVersion" INTEGER NOT NULL DEFAULT 1;
UPDATE "MeasurementSession" session SET analytics = false, advertising = false, fbp = NULL, fbc = NULL, "clientUserAgent" = NULL, "updatedAt" = CURRENT_TIMESTAMP
FROM "Store" store WHERE session."storeId" = store.id AND store.slug IN ('tapkin', 'kosykin') AND session."consentVersion" < 2
AND (session.analytics OR session.advertising OR session.fbp IS NOT NULL OR session.fbc IS NOT NULL OR session."clientUserAgent" IS NOT NULL);
UPDATE "MeasurementDelivery" delivery SET status = 'SKIPPED', "lastError" = 'Affirmative consent must be renewed', "leaseToken" = NULL, "leaseUntil" = NULL
FROM "MeasurementSession" session, "Store" store WHERE delivery."sessionId" = session.id AND delivery."storeId" = store.id
AND store.slug IN ('tapkin', 'kosykin') AND session."consentVersion" < 2 AND delivery.status = 'PENDING' AND delivery.provider IN ('GA4', 'META');
DO $restore_consent$
DECLARE row_record record; new_copy text; new_items jsonb;
BEGIN
  FOR row_record IN SELECT section.id, section.content, page.slug FROM "LandingPageSection" section
    JOIN "ContentPage" page ON page.id = section."pageId" AND page."storeId" = section."storeId"
    JOIN "Store" store ON store.id = section."storeId"
    WHERE store.slug IN ('tapkin', 'kosykin') AND page.slug IN ('privacy', 'faq')
  LOOP
    IF row_record.slug = 'privacy' AND jsonb_typeof(row_record.content->'copy') = 'string' THEN
      new_copy := row_record.content->>'copy';
      new_copy := replace(new_copy, 'measurement services subject to your privacy settings', 'consented measurement services');
      new_copy := replace(new_copy, 'receives shopping and website events unless you disable analytics', 'receives consented shopping and website events');
      new_copy := replace(new_copy, 'may record anonymous browsing unless you disable analytics', 'may record consented, anonymous browsing');
      new_copy := replace(new_copy, 'Configured analytics tools are active by default for new visitors. The first-visit notice explains this and offers an immediate opt-out. Use Privacy & cookie settings to disable analytics at any time. Existing saved opt-outs are respected. These tools remain inactive when not configured or enabled. Google explains its processing at https://policies.google.com/technologies/partner-sites.', 'These tools remain inactive when not configured or enabled and require analytics consent. Google explains its processing at https://policies.google.com/technologies/partner-sites.');
      new_copy := replace(new_copy, 'If configured and enabled, and unless you disable advertising measurement,', 'If enabled and you allow advertising measurement,');
      new_copy := replace(new_copy, 'Configured analytics and advertising measurement are active by default for new visitors. A first-visit notice provides an immediate option to disable either category or all optional tracking. Use Privacy & cookie settings to change these settings at any time; your previously saved choices remain respected. Preferences are stored in a store-specific browser cookie for up to one year. These settings do not enable a provider that has not been configured or switched on for the store.', 'Use Privacy & cookie settings to allow or decline optional analytics and advertising or change your choice later.');
      IF new_copy IS DISTINCT FROM row_record.content->>'copy' THEN
        UPDATE "LandingPageSection" SET content = jsonb_set(content, '{copy}', to_jsonb(new_copy)), "updatedAt" = CURRENT_TIMESTAMP WHERE id = row_record.id;
      END IF;
    ELSIF row_record.slug = 'faq' AND jsonb_typeof(row_record.content->'items') = 'array' THEN
      SELECT COALESCE(jsonb_agg(CASE WHEN item->>'question' = 'Can I decline analytics and advertising tracking?'
          AND item->>'answer' LIKE '%active by default for new visitors%'
        THEN jsonb_set(item, '{answer}', to_jsonb('Yes. Use Privacy & cookie settings to reject optional analytics and advertising or change your choices. This does not prevent buying or getting support. Optional providers run only when configured, enabled and accepted. Essential cookies support security, sign-in and checkout.'::text)) ELSE item END ORDER BY ordinality), '[]'::jsonb)
      INTO new_items FROM jsonb_array_elements(row_record.content->'items') WITH ORDINALITY AS entries(item, ordinality);
      IF new_items IS DISTINCT FROM row_record.content->'items' THEN
        UPDATE "LandingPageSection" SET content = jsonb_set(content, '{items}', new_items), "updatedAt" = CURRENT_TIMESTAMP WHERE id = row_record.id;
      END IF;
    END IF;
  END LOOP;
END $restore_consent$;
