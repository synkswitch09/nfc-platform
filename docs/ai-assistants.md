# Shared assistant portal

This feature runs in the existing Next.js application and PostgreSQL database. It does not provision another Azure App Service or database. Host routing selects the portal at `AI_ASSISTANTS_ORIGIN` (initially https://admin.tapkin.com.au); Tapkin and Kosykin retain their existing storefronts. Change this origin and the domain binding to move later.

## Included in this version

Public home, plans, connection guides, FAQ and draft terms/privacy; separate host-bound login sessions using the shared user identity; verified email; per-business ownership; draft and published knowledge/instructions; configurable authorized Claude models; website widget, conversations and human takeover; private support inbox; seven-day trial of one website channel with 100 responses and no automatic charge; paid Respond subscription at AUD 49/month with 1,000 responses. Global administrators can grant reasoned billing exemptions to their own businesses and authorize models. The Agenda plan is not available for purchase.

Instagram, Facebook Messenger and optional comment replies are implemented through the platform Meta app; see [Meta setup](assistant-meta.md) for credentials, review and production testing. Calls, external calendars and bookings are not connected in this release. Provider secrets and billing exemptions cannot be changed by customers. Model availability is controlled by a server-owned catalogue (`AI_ASSISTANT_MODELS`), with a provider interface for later adapters. Review model IDs against the provider account before activation.

## Activation checklist

1. Run the repository validation workflow and apply Prisma migrations through the existing controlled deployment process. Back up the database normally.
2. Bind admin.tapkin.com.au to the existing Azure app with HTTPS; set AI_ASSISTANTS_ORIGIN accordingly. No production domain binding is performed by this commit.
3. Configure ANTHROPIC_API_KEY, working transactional email for AI_ASSISTANTS_EMAIL_STORE, the model catalogue and approved website origins per business. Real provider calls are not part of local validation.
4. Use the existing Stripe account/STRIPE_SECRET_KEY. Create a monthly AUD 49 price and set AI_ASSISTANTS_STRIPE_RESPOND_PRICE. Configure a dedicated webhook at `/api/assistants/stripe/webhook` and set AI_ASSISTANTS_STRIPE_WEBHOOK_SECRET. Subscribe to checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid and invoice.payment_failed. Existing retail checkout remains separate.
5. Set AI_ASSISTANTS_STRIPE_PORTAL_CONFIGURATION to a Stripe portal configuration with invoice history and payment method updates enabled, plan changes disabled and cancellation at period end. Verify with test-mode payments before live activation. An unpaid invoice never grants access.
6. Review legal copy, customer pricing and support expectations; set AI_ASSISTANTS_ENABLED=true only when ready. Registration/checkout and automated replies are gated until then.

## Billing and lifecycle

The trial starts explicitly after approved origins and published knowledge are ready, once per shared user. No card or Stripe trial subscription is created. Checkout is an explicit later purchase. Subscriptions are synchronized against fresh Stripe state, validated customer/workspace metadata and configured price. Cancellation stops renewal at the end of the paid period; access remains through confirmed payment coverage. Separate Stripe customer records prevent mixing assistant subscriptions with store purchases.

The existing checkout reconciliation worker also calls assistant maintenance; no separate service is required. Configure a strong AI_ASSISTANTS_MAINTENANCE_SECRET or the existing CHECKOUT_RECONCILE_SECRET. Maintenance pauses expired access, queues email notices and performs bounded reconciliation. Data retention is normally 90 days. Deletion is disabled by default (`AI_ASSISTANTS_ALLOW_DELETION=false`) and additionally requires a successfully delivered final notice at least seven days earlier, terminal billing and no unresolved checkout. Mock emails never satisfy delivery. Deleting an assistant workspace does not delete the shared User, retail orders or Stripe invoices.

## Verification and limitations

Run npm run lint, npm run typecheck, npm test, python3 -m unittest discover -s tests -p 'test_*.py', npm run build and npm run test:assistant-http. The HTTP test verifies public portal pages, private redirects and storefront host separation without credentials or a database. CI additionally applies migrations to its disposable PostgreSQL database. Production migrations, DNS, provider delivery, real email and Stripe events require deployment/environment verification; passing local checks does not establish that they are live.

References: https://platform.claude.com/docs/en/api/messages/create ; https://platform.claude.com/docs/en/models/overview ; https://docs.stripe.com/billing/subscriptions/webhooks ; https://docs.stripe.com/customer-management/integrate-customer-portal

## Website or manual onboarding

Information now starts with two choices: I have a website (URL import) and I do not have a website (manual business/FAQ fields). Website imports need no Claude credentials or AI calls. A verified workspace owner or global administrator can import; private writes require same-origin requests and imports are rate limited. Imports return a candidate for review and never change saved or published answers automatically. Existing draft copy is preserved until the user chooses Replace draft. Saving and publishing remain explicit.

For a configured active store domain in the current environment, the importer reads published content pages, visible FAQ sections, published category FAQs and active shop-visible products. Product prices use the existing variant/option pricing helper; private stock counts, customer profiles and orders are not read. Public product detail visibility flags are respected. Source URLs and import time are included in the knowledge snapshot.

External sites use bounded HTTPS reads: up to 12 pages and 25 seconds, 750 KB per response, same-origin links, robots rules and noindex exclusions. Public DNS addresses are checked and pinned to the actual HTTPS socket to prevent DNS rebinding or internal network access; IP literals, local/private/metadata addresses, custom ports and credentials are rejected. Scripts do not execute. Product and FAQ JSON-LD can supplement visible text. Login-only pages, PDFs, images and client-rendered-only information are not imported.

The combined knowledge allowance remains 30,000 characters. The UI lists sources and explains skipped/truncated information; large websites require additional review. Imports are snapshots, not live synchronization: use the refresh/import control after changing a website, review the result and republish. Test real target websites after deployment. No new environment variables, provider charges, Stripe changes or database migrations are required for this feature.

WhatsApp Business Platform uses the same Meta app and worker, with independent channel controls. See [WhatsApp setup](assistant-whatsapp.md).
