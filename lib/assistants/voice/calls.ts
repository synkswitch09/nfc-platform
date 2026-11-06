import { db } from "@/lib/db";
import { AssistantError } from "../http";
import { assistantAccess } from "../policy";
import { campaignSchema, contactSchema } from "../growth/schema";
import { assertCallbackEligible, voiceSettingsSchema } from "./policy";
import { eleven } from "./provider";
export async function startCallback(
  workspaceId: string,
  userId: string,
  input: {
    campaignId: string;
    version: number;
    contactId: string;
    audioConsentEvidence: string;
  },
) {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
    const workspace = await tx.assistantWorkspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    if (
      !assistantAccess(workspace).active ||
      workspace.pausedAt ||
      !workspace.knowledgeApprovedAt
    )
      throw new AssistantError("Calls require active, published service.", 403);
    const record = await tx.assistantResource.findFirst({
      where: {
        id: input.campaignId,
        workspaceId,
        kind: "CAMPAIGN",
        status: "APPROVED",
        version: input.version,
      },
    });
    if (!record)
      throw new AssistantError(
        "Approve the current campaign version first.",
        409,
      );
    const campaign = campaignSchema.parse(record.data);
    if (
      campaign.channel !== "VOICE" ||
      campaign.maxCalls < 1 ||
      !campaign.contactIds.includes(input.contactId)
    )
      throw new AssistantError(
        "Choose a campaign contact and set a call allowance.",
      );
    const contactRecord = await tx.assistantResource.findFirst({
      where: { id: input.contactId, workspaceId, kind: "CONTACT" },
    });
    if (!contactRecord) throw new AssistantError("Contact not found.", 404);
    const contact = contactSchema.parse(contactRecord.data);
    const setting = await tx.assistantResource.findFirst({
      where: { workspaceId, kind: "VOICE_SETTINGS", status: "ACTIVE" },
    });
    if (!setting)
      throw new AssistantError(
        "The administrator must activate calling first.",
        409,
      );
    const config = voiceSettingsSchema.parse(setting.data);
    assertCallbackEligible(contact, config);
    const agent = await tx.assistantResource.findUnique({
      where: {
        workspaceId_kind_externalId: {
          workspaceId,
          kind: "VOICE_AGENT",
          externalId: `${record.id}:${record.version}`,
        },
      },
    });
    if (agent?.status !== "READY")
      throw new AssistantError(
        "Prepare this campaign's current voice agent first.",
      );
    const voice = await tx.assistantResource.findFirst({
      where: { workspaceId, kind: "VOICE", externalId: campaign.voiceId },
    });
    if (voice && voice.status !== "APPROVED")
      throw new AssistantError("This custom voice is not approved.");
    const calls = await tx.assistantResource.findMany({
      where: { workspaceId, kind: "CALL" },
      select: { data: true, createdAt: true },
    });
    // Every attempted number is fenced, including uncertain outcomes. No automatic redial.
    if (
      calls.some(
        (c) => (c.data as Record<string, unknown>).phone === contact.phone,
      )
    )
      throw new AssistantError(
        "This number has already been attempted. Review its history; repeated outbound calls are disabled.",
        409,
      );
    if (
      calls.filter(
        (c) => (c.data as Record<string, unknown>).campaignId === record.id,
      ).length >= campaign.maxCalls
    )
      throw new AssistantError("Campaign call allowance reached.");
    const period = new Date().toISOString().slice(0, 7);
    if (
      calls.filter((c) => c.createdAt.toISOString().startsWith(period)).length *
        3 +
        3 >
      config.monthlyMinuteLimit
    )
      throw new AssistantError(
        "Monthly reserved-minute allowance reached.",
        429,
      );
    const agentId = (agent.data as { agentId: string }).agentId,
      call = await tx.assistantResource.create({
        data: {
          workspaceId,
          kind: "CALL",
          title: `${record.title} · ${contact.name}`,
          status: "STARTING",
          externalId: `${record.id}:${contactRecord.id}`,
          data: {
            campaignId: record.id,
            campaignVersion: record.version,
            contactId: contactRecord.id,
            phone: contact.phone,
            agentId,
            reservedMinutes: 3,
            audioConsentEvidence: input.audioConsentEvidence,
            requestedBy: userId,
          },
        },
      });
    return {
      call,
      agentId,
      phone: contact.phone,
      phoneNumberId: config.phoneNumberId,
    };
  });
  try {
    const remote = await eleven("/v1/convai/twilio/outbound-call", "POST", {
      agent_id: result.agentId,
      agent_phone_number_id: result.phoneNumberId,
      to_number: result.phone,
      call_recording_enabled: false,
      conversation_initiation_client_data: {
        dynamic_variables: { tapkin_call_id: result.call.id },
      },
    });
    if (remote.success !== true)
      throw new AssistantError(
        "Call result is unconfirmed. Check the provider.",
        502,
      );
    // A signed post-call webhook may arrive before this HTTP response. Do not overwrite it.
    await db.assistantResource.updateMany({
      where: { id: result.call.id, status: "STARTING" },
      data: {
        status: "STARTED",
        data: {
          ...(result.call.data as object),
          conversationId:
            typeof remote.conversation_id === "string"
              ? remote.conversation_id
              : null,
          callSid: typeof remote.callSid === "string" ? remote.callSid : null,
        },
      },
    });
  } catch (error) {
    await db.assistantResource.updateMany({
      where: { id: result.call.id, status: "STARTING" },
      data: { status: "UNCERTAIN" },
    });
    throw error;
  }
}
