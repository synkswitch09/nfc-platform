-- Preserve rendered content and the sender through retries of durable order notifications.
ALTER TABLE "OrderNotification" ADD COLUMN "emailSnapshot" JSONB;
