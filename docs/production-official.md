# Official production site with orders closed

This is the production launch for Tapkin and Kosykin, indexed by search engines and editable in Admin. Orders remain closed until inventory, fulfillment, payments and launch operations are ready. It uses the production resource group, database, Blob storage and identity; staging data and credentials are not reused.

## Runtime

Set `APP_ENV=production`, `PRODUCTION_PREVIEW_MODE=false`, `PRODUCTION_CHECKOUT_ENABLED=false`, `APP_URL=https://tapkin.com.au`, `DATABASE_EXPECTED_NAME=tapkin_production`, `STORAGE_PROVIDER=azure-blob`, `STORAGE_ENVIRONMENT=production` and a production-only Blob container URL. Configure distinct TLS `DATABASE_URL`, `SESSION_SECRET`, `ACTIVATION_PEPPER` and scoped storage SAS. Configure a live transactional email sender and its webhook secret for account verification and password reset. Leave Stripe keys unset while checkout is closed.

For Resend, verify both sending domains in its dashboard and add the DNS records it provides. Set `EMAIL_MODE=live`, `EMAIL_PROVIDER=resend`, `EMAIL_WEBHOOK_URL=https://api.resend.com/emails`, and `EMAIL_WEBHOOK_SECRET` to a shared sending API key held in an Azure Container App secret. The shared key must permit sending from every store's verified domain. Configure the default, orders, account, promotions and support sender names and addresses per store in CMS Settings. Sender validation uses the store's registered primary production domain; defaults use `hello@<store-domain>` and category addresses on that domain. New stores require no sender environment variables. The optional existing `EMAIL_WEBHOOK_SECRET_KOSYKIN` key remains supported for Kosykin while migrating to a shared key. `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_ADDRESS_KOSYKIN` are ignored by the application and removed from the application and migration job during deployment. The site DNS records used for Azure hosting do not verify email sending. Keep staging on its separate Mailtrap Sandbox credentials.

The production domain must have DNS, a verified Container Apps custom domain and a valid certificate before the workflow smoke test uses it. Bind `kosykin.com.au` to the same app when its Store and content are ready. Run migrations with the production migration job, bootstrap a real production administrator through a one-time operational process and import reviewed storefront releases from staging. Release imports create variants with zero inventory. Review all variants for `trackInventory=true` and `backorderPolicy=DENY`; the separate checkout flag still blocks any purchase regardless of variant policy.

Do not run the development seed in production. Keep the production GitHub environment restricted to `main` with a required reviewer. Promote reviewed application code from staging to `main`, manually dispatch the production workflow and approve the environment deployment.

## Verification

- `/api/health/live` and `/api/health/ready` succeed over both bound domains.
- `/robots.txt` allows public content and names `/sitemap.xml`; the sitemap lists only published, indexable pages for the correct Store. Published pages have their intended canonical URLs and do not have a blanket `X-Robots-Tag: noindex`.
- Admin login, CMS edits, account email and other intended flows work against the production database.
- Product pages show orders are closed, structured offers say `OutOfStock`, and `POST /api/checkout` returns 503 before creating an order, even for untracked or backorderable variants.
- Confirm backups and restore procedures, monitoring, legal/privacy content and mobile layout before inviting traffic. Search indexing is controlled by crawlers and can take time after the site becomes accessible.

Opening sales later is a separate release: configure production Stripe keys and webhook, verify inventory and shipping, then explicitly set `PRODUCTION_CHECKOUT_ENABLED=true` and deploy.
