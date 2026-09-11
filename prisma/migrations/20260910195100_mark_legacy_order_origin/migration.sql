-- Correct the temporary compatibility values written by the foundation migration.
-- New orders already record the resolved request hostname and real environment.
UPDATE "Order"
SET "checkoutEnvironment" = 'LEGACY',
    "sourceDomain" = 'legacy-unrecorded'
WHERE "checkoutEnvironment" = 'DEVELOPMENT'
  AND "sourceDomain" = 'tapkin.com.au';

-- LEGACY is valid only as an Order snapshot, never as a routable Store domain.
ALTER TABLE "StoreDomain"
ADD CONSTRAINT "StoreDomain_environment_not_legacy_check"
CHECK ("environment" <> 'LEGACY');
