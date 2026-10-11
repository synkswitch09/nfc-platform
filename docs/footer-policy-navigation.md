# Footer and registered brand presentation

One release across develop, staging and production. The owner confirmed both
Tapkin and Kosykin business names registered with ASIC on the same proprietor
and ABN 84 884 117 384. No new company, credentials or GST registration is created.
The legal holder remains in Store settings; the public terms show only the
registered business name and spaced ABN at the bottom. GST status is read from
the existing CMS setting, and a non-registration note is shown within Prices
and GST at the end of the terms, not in the page heading.

Content → Storefront → Footer manages the independent uploaded logo, four
footer links, policy submenu and social networks. The chosen full Kosykin wordmark is the existing transparent CMS asset in each
environment, so the footer cream background shows through without a white box;
no logo is bundled or derived in code and the header media is unchanged.

The owner can add any network with a name, HTTPS destination and uploaded or
selected icon, reorder it, hide it, or remove it. Existing Facebook/Instagram
icons and links are adopted when the new list has not yet been saved. An icon
without a URL retains its decorative preview; no social destinations are invented.
An explicitly empty social list stays empty. Storefront release import/export
and media-reference cleanup operate recursively on the configuration as before.

The one-time database migration disables automatic footer page inclusion and
sets Help & Requests and Frequently Asked Questions as custom links alongside
Terms & Conditions and Privacy Policy. Other policy pages remain published and
indexable. Kosykin receives its five policy submenu destinations; Tapkin only
receives its existing terms destination (no missing policy routes are fabricated).
Submenu links are editable at Storefront → Footer and mark the selected page.
The include-pages checkbox allows opting back into page placement from the CMS.

Migration checks run only against the disposable CI database and verify original
sections, edited FAQs, legal holder, existing logo, social icons and destinations
are retained. Only the outdated initial Kosykin-under-Tapkin wording is adjusted.
