import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { kosykinContent } from "../lib/kosykin-content";

const pages = kosykinContent.map(page => ({ ...page, sections: page.sections.map(section => ({ ...section, content: { ...section.content, ...(section.type === "FAQ" ? { items: (section.content.items as Record<string, unknown>[]).map((item, index) => {
  const hash = createHash("sha256").update(`${page.slug}:${section.name}:${index}`).digest("hex");
  return { ...item, id: `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}` };
}) } : {}) } })) }));
const directory = "prisma/migrations/20261014000000_kosykin_policies_faq";
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/migration.sql`, `-- One-time Kosykin editorial release. No credentials or operational settings change.
-- Previous legal sections stay in the CMS, hidden rather than deleted.
-- Existing FAQ questions are retained; duplicate questions are not added.
DO $phase6$
DECLARE
  store_id uuid;
  page_id uuid;
  page jsonb;
  section jsonb;
  position integer;
  page_position integer := 0;
  faq_items jsonb;
BEGIN
  SELECT id INTO store_id FROM "Store" WHERE slug = 'kosykin';
  IF store_id IS NULL THEN RETURN; END IF;
  -- Identity supplied by the business owner (ABN Lookup screenshot, 11 Oct 2026).
  UPDATE "Store" SET "legalName" = 'FORERO GUTIERREZ, YULIANY ROCIO',
    organization = organization || '{"abn":"84884117384","registeredBusinessName":"Tapkin","gstRegistered":false}'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP WHERE id = store_id;
  FOR page IN SELECT value FROM jsonb_array_elements($content$${JSON.stringify(pages)}$content$::jsonb) LOOP
    INSERT INTO "ContentPage" (id, "storeId", kind, slug, name, status, "showInFooter", "navigationOrder", "seoTitle", "seoDescription", indexable, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), store_id, CASE WHEN page->>'slug' = 'faq' THEN 'CAMPAIGN'::"ContentPageKind" ELSE 'LEGAL'::"ContentPageKind" END,
      page->>'slug', page->>'name', 'PUBLISHED', true, 500 + page_position, (page->>'name') || ' | Kosykin', page->>'description', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("storeId", slug) DO UPDATE SET status = 'PUBLISHED', "showInFooter" = true,
      kind = EXCLUDED.kind, "seoTitle" = EXCLUDED."seoTitle", "seoDescription" = EXCLUDED."seoDescription", indexable = true, "updatedAt" = CURRENT_TIMESTAMP;
    SELECT id INTO page_id FROM "ContentPage" WHERE "storeId" = store_id AND slug = page->>'slug';
    IF page->>'slug' <> 'faq' THEN
      UPDATE "LandingPageSection" SET visible = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "pageId" = page_id AND "storeId" = store_id;
    END IF;
    SELECT COALESCE(max("sortOrder") + 1, 0) INTO position FROM "LandingPageSection" WHERE "pageId" = page_id;
    FOR section IN SELECT value FROM jsonb_array_elements(page->'sections') LOOP
      IF section->>'type' = 'FAQ' THEN
        SELECT jsonb_agg(item ORDER BY (item->>'order')::integer) INTO faq_items
        FROM jsonb_array_elements(section->'content'->'items') item
        WHERE NOT EXISTS (
          SELECT 1 FROM "LandingPageSection" old,
            LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(old.content->'items') = 'array' THEN old.content->'items' ELSE '[]'::jsonb END) previous
          WHERE old."pageId" = page_id AND old.type = 'FAQ'
            AND lower(regexp_replace(previous->>'question', '[^a-zA-Z0-9]+', ' ', 'g')) = lower(regexp_replace(item->>'question', '[^a-zA-Z0-9]+', ' ', 'g'))
        );
        IF faq_items IS NULL THEN CONTINUE; END IF;
        section := jsonb_set(section, '{content,items}', faq_items);
      END IF;
      INSERT INTO "LandingPageSection" (id, "storeId", "pageId", type, name, visible, "sortOrder", content, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), store_id, page_id, (section->>'type')::"LandingSectionType", section->>'name', true, position, section->'content', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      position := position + 1;
    END LOOP;
    page_position := page_position + 1;
  END LOOP;
END $phase6$;
`);
