# Configurable category experience audit — 10 September 2026

## Outcome

Tapkin now seeds five normal, fully managed category records: Pet, Child, Business, Social Media and Luggage. Each category has a clean public URL, unique commercial content, a CMS-selected visual theme and a CMS-selected section composition. No public or tag behaviour is hardcoded from the category name.

The previous category URLs are retained as historical aliases and permanently redirect to `/pet`, `/child`, `/business`, `/social-media` and `/luggage`. Future slug edits made in Admin retain the old slug and update standard filtered-Shop CTAs automatically.

## CMS and presentation

Admin can create or edit a category's identity, lifecycle, order, Home card, image URLs/alt text, hero, CTAs, benefits, use cases, how-it-works steps, typed story sections, FAQ, final CTA, visibility, SEO, visual theme and page composition. All content remains structured and rendered as React text; arbitrary HTML is not accepted.

The public category renderer is shared, but each composition has a different storytelling order and the five seed records carry distinct messages, icons, benefits, use cases and theme tokens. Home, navigation, Shop, products, breadcrumbs, canonicals, structured data and sitemap all use the clean category URLs.

No unlicensed photography was added. Styled, accessible Tapkin placeholders keep layouts complete until owned category photography is provided. Product images can already be uploaded in Admin. Update (12 September 2026): category Homepage card, social sharing and modular landing images can now also be uploaded directly in Admin; validated HTTPS URLs remain supported.

## Privacy and continuity

Child content is guardian-led and warns against publishing surnames, addresses, schools, routines or other identifying details. The owner editor labels the name as a public alias/first name and makes clear that populated fields can appear after a scan. A formal child-data privacy impact assessment remains required before launch.

Category visibility remains a commercial concern. A `HIDDEN` or `ARCHIVED` category disappears from Home, navigation, Shop and its landing. The public tag resolver still fetches only `NFCTag` and its profile; it does not join or require a published category or active product. Existing active/lost tags therefore remain operational and owner-manageable.

## Verification

| Check | Result |
|---|---|
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Vitest | 44 tests passed across 11 files |
| Production build | Passed with Next.js 16.3.4/Turbopack |
| HTTP/database E2E in GitHub Actions | Passed, including migrations, seed, category/Shop journey and issued-tag continuity |
| Secret-pattern scan | No live credentials found |
| Branch | Changes committed and pushed only to `develop`; `main` untouched |

The earlier GitHub failure was caused by the HTTP E2E fixture sending a nonexistent `shape` personalisation option to the seeded Round Pet Tag. The server correctly rejected the unknown option. The fixture now sends only the supported pet-name and colour fields, and the latest CI run succeeds.

## Remaining visual work

The code and responsive CSS were reviewed at mobile, tablet and desktop breakpoints, but this workspace has no running PostgreSQL/browser staging surface for screenshot-based visual QA. Perform the final browser pass after owned imagery is uploaded, covering all five landings, Home, filtered Shop, product detail and Admin category editing.
