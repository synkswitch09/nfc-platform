-- Development domains need an explicit non-default port for canonical URLs,
-- OAuth callbacks and checkout redirects. Production/staging keep NULL.
ALTER TABLE "StoreDomain" ADD COLUMN "port" INTEGER;
UPDATE "StoreDomain" SET "port" = 3000 WHERE "environment" = 'DEVELOPMENT';
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_port_check" CHECK ("port" IS NULL OR "port" BETWEEN 1 AND 65535);
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_protocol_check" CHECK ("protocol" IN ('http', 'https'));
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_hostname_lowercase_check" CHECK ("hostname" = lower("hostname"));
CREATE UNIQUE INDEX "StoreDomain_one_primary_per_store_environment" ON "StoreDomain"("storeId", "environment") WHERE "isPrimary" = true;
