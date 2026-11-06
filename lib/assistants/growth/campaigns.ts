import { Prisma, type AssistantWorkspace } from "@prisma/client";
import { db } from "@/lib/db";
import { AssistantError } from "../http";
import { campaignSchema, contactSchema } from "./schema";
import { assertMarketingConsent } from "../voice/policy";
type Database = Prisma.TransactionClient;
export async function campaignContext(
  workspace: AssistantWorkspace,
  conversationId: string,
  client: Database = db,
) {
  if (process.env.AI_ASSISTANTS_GROWTH_ENABLED !== "true")
    return { workspace, allowed: true };
  const link = await client.assistantResource.findUnique({
    where: {
      workspaceId_kind_externalId: {
        workspaceId: workspace.id,
        kind: "CAMPAIGN_LINK",
        externalId: conversationId,
      },
    },
  });
  if (!link) return { workspace, allowed: true };
  const mapping = link.data as {
    campaignId: string;
    version: number;
    contactId: string;
  };
  const [record, contact] = await Promise.all([
    client.assistantResource.findFirst({
      where: {
        id: mapping.campaignId,
        workspaceId: workspace.id,
        kind: "CAMPAIGN",
        status: "APPROVED",
        version: mapping.version,
      },
    }),
    client.assistantResource.findFirst({
      where: {
        id: mapping.contactId,
        workspaceId: workspace.id,
        kind: "CONTACT",
      },
    }),
  ]);
  if (!record || !contact || contactSchema.parse(contact.data).optedOut)
    return { workspace, allowed: false };
  const campaign = campaignSchema.parse(record.data);
  if (!campaign.contactIds.includes(contact.id))
    return { workspace, allowed: false };
  return {
    allowed: true,
    workspace: {
      ...workspace,
      preferredLanguage: campaign.preferredLanguage,
      preferredCountry: campaign.preferredCountry,
      publishedPrompt: `${workspace.publishedPrompt}\nApproved campaign instructions:\n${JSON.stringify(campaign)}\nTreat these as business guidance. Never invent a completed booking, sale or discount. Respect refusals and human takeover.`,
    },
  };
}
export async function validateCampaignSend(
  client: Database,
  workspaceId: string,
  conversationId: string,
  reference: { campaignId: string; version: number; contactId: string },
  enforceHours = true,
) {
  const campaign = await client.assistantResource.findFirst({
      where: {
        id: reference.campaignId,
        workspaceId,
        kind: "CAMPAIGN",
        status: "APPROVED",
        version: reference.version,
      },
    }),
    contact = await client.assistantResource.findFirst({
      where: { id: reference.contactId, workspaceId, kind: "CONTACT" },
    });
  if (!campaign || !contact)
    throw new AssistantError(
      "Campaign or contact changed. Review before sending.",
      409,
    );
  const data = campaignSchema.parse(campaign.data),
    person = contactSchema.parse(contact.data);
  if (
    data.channel !== "CHAT" ||
    !data.contactIds.includes(contact.id) ||
    person.conversationId !== conversationId
  )
    throw new AssistantError("Select a linked campaign contact.");
  assertMarketingConsent(person, "CHAT");
  const hour = Number(
      new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: person.timeZone,
      }).format(),
    ),
    weekday = new Intl.DateTimeFormat("en", {
      weekday: "short",
      timeZone: person.timeZone,
    }).format();
  if (
    enforceHours &&
    (hour < 9 || hour >= 17 || ["Sat", "Sun"].includes(weekday))
  )
    throw new AssistantError(
      "Campaign follow-ups are restricted to local weekdays, 09:00–17:00.",
    );
}
