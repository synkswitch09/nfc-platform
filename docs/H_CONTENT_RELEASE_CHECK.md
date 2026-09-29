# Block H: content and FAQ release check

The existing `/faq` route combines general answers with FAQs from published categories. In Admin → Content → Pages → Frequently asked questions, the suggestion action offers general NFC and 3D printing drafts only when that store has the corresponding capability. Suggested answers start hidden. The editor compares question text against the current general and published category questions before adding; it does not change any saved item automatically. Saving updates only the general FAQ section and refuses to overwrite a section changed in another session. Existing Pets FAQs stay in their category.

## Review on an authorised copy of the real store

1. Take an operational backup, inspect the real Pets category and FAQ page, and compare questions and meaning against `docs/audit/FAQ_CONTENT_PLAN.md`. The development seed is not a record of live changes.
2. Open the existing FAQ editor for the correct store, add hidden drafts, then review each answer against active products, activation, privacy, shipping and commercial policies. Show only confirmed answers. Keep product or pet-specific answers with their category. Do not publish the 16 unanswered commercial/hardware questions or promise unverified 3D services.
3. Save, reload and verify item visibility and order, including keyboard and mobile accordions. Check the public `/faq`, the guide link and store separation. A 3D-only store should not inherit NFC suggestions.
4. Use the existing Page editor for a service or guide draft only when the service is actually offered; set its navigation placement deliberately. Check that every CTA and link resolves on that store. A custom file upload or Adelaide collection must be implemented and verified before claiming it exists.
5. Repeat the review after importing a storefront release; imports may replace CMS content. Do not run seed or reset to add FAQ content.

## Evidence and limitations

No live Pets dataset or database was available for this change. No FAQ was loaded into a real store, and no service page was published. Market demand, pricing, margins and competition remain unmeasured; do not infer sales from search volume. Before expanding the catalogue, record query, intent, Australian geography, dated source and period, exact/estimated/relative units, competitors, price, production cost, fees, shipping and margin; use `ND` where a number is unavailable.
