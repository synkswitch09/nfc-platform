# Mobile CMS and storefront check

This code pass improves the existing responsive layout without changing stored CMS content. Main changes: a collapsible admin navigation, compact catalogue/order/page/inventory cards, one-column filters and editors, bounded preset grids after the late CSS declarations, and smaller images/headlines on narrow screens. Dense operational tables still scroll inside their panel with a visible swipe hint.

A second code review fixed late CMS styles that still forced three columns for category cards, badges, trust and stats on phones, and restored single-column showcase/story sections for non-editorial presets. Editorial sections now use bounded columns on tablets (801–1050 px). Section editor actions wrap as 44 px touch targets instead of being squeezed into an 86 px column. These changes have not been visually accepted on a running store.

## Acceptance on a running store

Test at 320, 375, 390 and 430 CSS pixels in portrait, then 768 and 1024 pixels. On each width check both Tapkin and a non-NFC Store with real saved Home and category variants. There should be no document-level horizontal scroll, clipped CTA, invisible save control or overlapping text.

- Storefront: Home sections using every active CMS preset, header menu with many links, category landing, Shop filters, product variant selectors and gallery, cart, checkout address and quote selection, FAQ accordion, legal pages, and public pet profile.
- CMS: mobile menu and store switcher, Dashboard, Products, Categories, Pages, Home section editor, product variants and option values, Inventory adjustment, Orders and fulfilment, Media upload, Shipping and Settings. Save and reload a draft page or section and verify order and visibility; do not change production content just for a layout test.
- Touch and keyboard: 44 px controls, focus and expanded state, long headings and translations, wrapped SKUs, horizontal tables with a swipe hint, no hidden destructive actions. Rotate to landscape and repeat the section editor and checkout.

Automated typecheck, lint, unit suite and production build check syntax and regressions; they do not establish visual acceptance. The browser in this workspace could not reach the local server, and the documented public domain returned a gateway error. No authenticated CMS or device screenshot was available, so the viewport matrix remains **NOT RUN** against real data.
