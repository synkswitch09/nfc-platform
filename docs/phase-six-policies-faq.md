# Phase 6: Kosykin policies and FAQs

The one-time migration publishes six legal pages and 82 FAQs for the Kosykin
store only. Production and staging receive the same editorial release. Public
content is read from the database and remains editable through Content → Pages;
the TypeScript source is an initial release, not a live override of CMS edits.

Pages: `/terms`, `/privacy`, `/shipping-delivery`, `/returns-cancellations`,
`/custom-designs`, `/customer-points`, `/faq`. Footer placement, names, SEO,
visibility and content are editable in the CMS. The eight FAQ topics use the
structured section editor because flattening 82 questions into the previous
single-topic editor would exceed its 30-question limit. Existing questions are
retained and duplicate questions are skipped during import. Replaced legal
sections are hidden and retained in the CMS rather than deleted.

Legal identity: the owner supplied ABN Lookup evidence on 11 October 2026:
FORERO GUTIERREZ, YULIANY ROCIO; ABN 84 884 117 384; sole trader, active ABN;
not registered for GST. Tapkin is the registered business name according to
the owner's statement. Store settings now expose legal seller, registered
business name, checksum-validated ABN and GST status. Policy headings read those
settings, so future identity corrections do not require code changes. The
migration sets this identity only on Kosykin, leaving Tapkin records unchanged.

## Operational follow-up

- Register Kosykin as a business name if trading under that name requires it.
  Calling it a brand under Tapkin does not itself meet ASIC registration rules.
  No registration is represented as having been performed by this release.
- Obtain Australian legal review of the actual seller, policies and operational
  practices before opening paid checkout. A complete policy is not a guarantee
  of compliance across every future product or law.
- Complete material, dimensions, compatibility, safety, care, expected production
  time and any certifications on each product. These FAQs deliberately do not
  invent PLA, food-safety, heat resistance, environmental or electrical claims.
- Follow the published pre-production cancellation and returns processes; maintain
  the support queue and update store holidays. Five business days is the first
  response target, not the resolution time or an excuse to defer safety duties.
- Confirm provider processing locations and retention operations as contracts or
  infrastructure change; update the privacy text accordingly. Account deletion
  is a reviewed request, not an immediate erasure promise.
- Review a custom job's rights, proof, scope, file format and confidentiality before
  accepting it. This release does not add a new public design-upload service.
- Optional Geoapify, Google Analytics, Clarity, Meta Pixel, CAPI and the catalogue
  are described conditionally. No credentials or consent settings are enabled by
  this release. Production checkout remains closed.
- Editing points or support settings may require updating corresponding policy
  copy. Existing order point rules remain snapshotted. The FAQ's numerical rates
  are labelled as initial settings, not an immutable promise for future orders.

## Legal and search references checked 11 October 2026

Primary references used to cross-check the text and operating limitations:

- ACCC consumer guarantees:
  https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees
- ACCC remedies and change-of-mind distinction:
  https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought/repair-replace-refund-cancel
- ACCC compensation:
  https://www.accc.gov.au/business/problem-with-a-product-or-service-you-sold/compensation-claims
- ACCC loyalty schemes:
  https://www.accc.gov.au/business/advertising-and-promotions/customer-loyalty-schemes
- Australian Consumer Law, Competition and Consumer Act Schedule 2:
  https://www.legislation.gov.au/C2004A00109/latest/
- OAIC Australian Privacy Principles:
  https://www.oaic.gov.au/privacy/australian-privacy-principles/read-the-australian-privacy-principles
- OAIC small-business applicability:
  https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business
- OAIC overseas disclosures:
  https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information
- OAIC privacy complaint handling:
  https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-1-app-1-open-and-transparent-management-of-personal-information
- OAIC notifiable data breaches:
  https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches
- ACMA marketing consent, identification and unsubscribe:
  https://www.acma.gov.au/avoid-sending-spam
- ASIC business-name registration:
  https://asic.gov.au/for-business-and-companies/business-names/register-a-business-name
- ATO record keeping:
  https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business/overview-of-record-keeping-rules-for-business
- ACCC product safety:
  https://www.accc.gov.au/business/selling-products-and-services/product-safety-responsibilities
- Google FAQ structured-data limitation:
  https://developers.google.com/search/blog/2023/08/howto-faq-changes

Production pages are indexable and included in the sitemap through existing
published-page rules. Staging stays noindex. FAQ JSON-LD reflects only visible
rendered questions and answers, and escapes HTML-sensitive characters. No SEO
ranking, rich-result appearance or AI recommendation is promised; Google limits
FAQ rich results to eligible authoritative government and health sites.

## Verification

Unit coverage checks CMS schemas, topic limits, unique questions, the generated
migration's correspondence to authored text and ABN validation. A CI-only test
executes the migration against a disposable PostgreSQL fixture containing older
policy text and a duplicate FAQ; it verifies published/editable content, retained
sections, retained answers and isolation from Tapkin. Existing application unit
and HTTP E2E checks remain required in every environment's validation workflow.
