-- AlterTable
ALTER TABLE "AssistantMessage" ADD COLUMN     "deliveryStatus" TEXT;

-- AlterTable
ALTER TABLE "AssistantSocialConnection" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "whatsAppAccountId" TEXT;


-- Preserve existing IG/FB automation; new connections start paused.
ALTER TABLE "AssistantSocialConnection" ALTER COLUMN "enabled" SET DEFAULT false;
ALTER TABLE "AssistantSocialConnection" DROP CONSTRAINT "AssistantSocialConnection_provider_check";
ALTER TABLE "AssistantSocialConnection" ADD CONSTRAINT "AssistantSocialConnection_provider_check" CHECK ("provider" IN ('FACEBOOK','INSTAGRAM','WHATSAPP'));
ALTER TABLE "AssistantSocialConnection" ADD CONSTRAINT "AssistantSocialConnection_whatsapp_check" CHECK ("provider" <> 'WHATSAPP' OR ("whatsAppAccountId" IS NOT NULL AND NOT "autoComments"));
CREATE INDEX "AssistantSocialConnection_whatsAppAccountId_idx" ON "AssistantSocialConnection"("whatsAppAccountId");
