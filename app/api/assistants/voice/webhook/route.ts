import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assistantError, AssistantError } from "@/lib/assistants/http";
import { boundedBytes } from "@/lib/assistants/growth/body";
import {
  validVoiceSignature,
  providerId,
} from "@/lib/assistants/voice/provider";
export async function POST(request: NextRequest) {
  try {
    const raw = new TextDecoder().decode(
      await boundedBytes(request, 1_000_000),
    );
    if (!validVoiceSignature(raw, request.headers.get("elevenlabs-signature")))
      throw new AssistantError("Invalid signature.", 401);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AssistantError("Invalid JSON.");
    }
    const type = z.object({ type: z.string() }).parse(json).type;
    if (type !== "post_call_transcription")
      return NextResponse.json({ received: true });
    const { data } = z
      .object({
        data: z.object({
          agent_id: providerId,
          conversation_id: providerId,
          transcript: z
            .array(
              z.object({
                role: z.string().max(30),
                message: z.string().nullable().optional(),
              }),
            )
            .max(500)
            .optional(),
          metadata: z
            .object({ call_duration_secs: z.number().nonnegative().optional() })
            .optional(),
          conversation_initiation_client_data: z
            .object({
              dynamic_variables: z
                .object({ tapkin_call_id: z.uuid().optional() })
                .optional(),
            })
            .optional(),
        }),
      })
      .parse(json);
    const agent = await db.assistantResource.findFirst({
      where: {
        kind: "VOICE_AGENT",
        status: "READY",
        data: { path: ["agentId"], equals: data.agent_id },
      },
    });
    if (!agent) return NextResponse.json({ received: true });
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${agent.workspaceId}::uuid FOR UPDATE`;
      const callId =
        data.conversation_initiation_client_data?.dynamic_variables
          ?.tapkin_call_id;
      const prior = await tx.assistantResource.findFirst({
        where: {
          workspaceId: agent.workspaceId,
          kind: "CALL",
          OR: [
            {
              data: { path: ["conversationId"], equals: data.conversation_id },
            },
            ...(callId
              ? [
                  {
                    id: callId,
                    data: { path: ["agentId"], equals: data.agent_id },
                  },
                ]
              : []),
          ],
        },
      });
      if (prior && (prior.data as Record<string, unknown>).transcriptReceived)
        return;
      const details = {
        ...((prior?.data as object) || {}),
        agentId: data.agent_id,
        conversationId: data.conversation_id,
        transcript: (data.transcript || []).map((t) => ({
          role: t.role,
          text: (t.message || "").slice(0, 4000),
        })),
        durationSeconds: data.metadata?.call_duration_secs || 0,
        reviewRequired: true,
        transcriptReceived: true,
        transcriptExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      if (prior)
        await tx.assistantResource.update({
          where: { id: prior.id },
          data: { status: "REVIEW_REQUIRED", data: details },
        });
      else
        await tx.assistantResource.upsert({
          where: {
            workspaceId_kind_externalId: {
              workspaceId: agent.workspaceId,
              kind: "CALL",
              externalId: data.conversation_id,
            },
          },
          create: {
            workspaceId: agent.workspaceId,
            kind: "CALL",
            title: `Voice conversation · ${agent.title}`,
            externalId: data.conversation_id,
            status: "REVIEW_REQUIRED",
            data: details,
          },
          update: {},
        });
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    return assistantError(error);
  }
}
