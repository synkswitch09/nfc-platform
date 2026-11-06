import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  assistantError,
  assistantWrite,
  ownedWorkspace,
  AssistantError,
} from "@/lib/assistants/http";
import { boundedBytes, boundedJson } from "@/lib/assistants/growth/body";
import {
  availableVoices,
  eleven,
  providerId,
  voiceReady,
  voiceLanguages,
} from "@/lib/assistants/voice/provider";
import { prepareVoiceAgent } from "@/lib/assistants/voice/agents";
import { voiceSettingsSchema } from "@/lib/assistants/voice/policy";
import { startCallback } from "@/lib/assistants/voice/calls";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { id } = await params,
      { user } = await ownedWorkspace(id);
    const resources = await db.assistantResource.findMany({
      where: {
        workspaceId: id,
        kind: { in: ["VOICE", "VOICE_AGENT", "VOICE_SETTINGS", "CALL"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const owned = resources.filter((r) => r.kind === "VOICE"),
      settings = resources.find((r) => r.kind === "VOICE_SETTINGS");
    let voices: { id: string; name: string }[] = [],
      providerIssue = "";
    if (voiceReady()) {
      try {
        voices = (await availableVoices())
          .filter(
            (v) =>
              v.category === "premade" ||
              owned.some(
                (o) => o.externalId === v.voice_id && o.status === "APPROVED",
              ),
          )
          .map((v) => ({ id: v.voice_id, name: v.name }));
      } catch {
        providerIssue =
          "Voice catalog is unavailable. Existing history is still shown.";
      }
    }
    return NextResponse.json(
      {
        ready: voiceReady(),
        voices,
        owned,
        calls: resources.filter((r) => r.kind === "CALL").slice(0, 50),
        agents: resources.filter((r) => r.kind === "VOICE_AGENT"),
        languages: voiceLanguages,
        settings: user.role === "ADMIN" ? settings?.data : null,
        callingEnabled: settings?.status === "ACTIVE",
        providerIssue,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return assistantError(error);
  }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    assistantWrite(request);
    const { id } = await params,
      { workspace, user } = await ownedWorkspace(id);
    if (!(await rateLimit("assistant-voice", user.id, 10, 60000)).allowed)
      throw new AssistantError("Wait before trying another voice action.", 429);
    if (
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      if (!voiceReady())
        throw new AssistantError("Voice setup is required first.", 503);
      const bytes = await boundedBytes(request, 10_000_000),
        form = await new Response(bytes, {
          headers: { "content-type": request.headers.get("content-type")! },
        }).formData();
      const name = z.string().trim().min(2).max(80).parse(form.get("name")),
        evidence = z
          .string()
          .trim()
          .min(20)
          .max(2000)
          .parse(form.get("evidence"));
      if (form.get("authorization") !== "on")
        throw new AssistantError(
          "Confirm explicit authorization to clone this voice.",
        );
      const files = form.getAll("samples");
      if (
        files.length < 1 ||
        files.length > 3 ||
        files.some(
          (f) =>
            !(f instanceof File) ||
            f.size < 1000 ||
            ![
              "audio/mpeg",
              "audio/wav",
              "audio/x-wav",
              "audio/mp4",
              "audio/ogg",
              "audio/webm",
            ].includes(f.type),
        )
      )
        throw new AssistantError(
          "Upload 1–3 MP3, WAV, M4A, OGG or WebM recordings, at most 10 MB combined.",
        );
      const hashes = await Promise.all(
        files.map(async (f) =>
          createHash("sha256")
            .update(Buffer.from(await (f as File).arrayBuffer()))
            .digest("hex"),
        ),
      );
      const pending = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${id}::uuid FOR UPDATE`;
        if (
          (await tx.assistantResource.count({
            where: {
              workspaceId: id,
              kind: "VOICE",
              status: { not: "DELETED" },
            },
          })) >= 5
        )
          throw new AssistantError(
            "Limit of five custom voice requests per business.",
          );
        return tx.assistantResource.create({
          data: {
            workspaceId: id,
            kind: "VOICE",
            title: name,
            status: "CREATING",
            data: {
              authorizationEvidence: evidence,
              authorizedBy: user.id,
              authorizedAt: new Date().toISOString(),
              sampleHashes: hashes,
            },
          },
        });
      });
      try {
        const upload = new FormData();
        upload.set("name", `Tapkin ${id.slice(0, 8)} ${name}`);
        for (const file of files) upload.append("files", file);
        const result = z
          .object({ voice_id: providerId, requires_verification: z.boolean() })
          .parse(await eleven("/v1/voices/add", "POST", upload));
        await db.assistantResource.update({
          where: { id: pending.id },
          data: {
            status: "REVIEW_REQUIRED",
            externalId: result.voice_id,
            data: {
              ...(pending.data as object),
              requiresVerification: result.requires_verification,
            },
          },
        });
        return NextResponse.json({
          message:
            "Voice created for authorization review. Complete any provider verification before approval.",
        });
      } catch (error) {
        await db.assistantResource.update({
          where: { id: pending.id },
          data: { status: "UNCERTAIN" },
        });
        throw error;
      }
    }
    const { action, ...body } = z
      .object({ action: z.string() })
      .passthrough()
      .parse(await boundedJson(request));
    if (action === "settings") {
      if (user.role !== "ADMIN")
        throw new AssistantError("Administrator access required.", 403);
      const config = voiceSettingsSchema.parse(body);
      await eleven(`/v1/convai/phone-numbers/${config.phoneNumberId}`);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`voice-phone:${config.phoneNumberId}`}))`;
        if (
          await tx.assistantResource.findFirst({
            where: {
              kind: "VOICE_SETTINGS",
              externalId: config.phoneNumberId,
              workspaceId: { not: id },
            },
          })
        )
          throw new AssistantError(
            "This line belongs to another business.",
            409,
          );
        const old = await tx.assistantResource.findFirst({
            where: { workspaceId: id, kind: "VOICE_SETTINGS" },
          }),
          data = {
            title: "Voice activation",
            status: config.enabled ? "ACTIVE" : "PAUSED",
            externalId: config.phoneNumberId,
            data: config,
          };
        if (old)
          await tx.assistantResource.update({ where: { id: old.id }, data });
        else
          await tx.assistantResource.create({
            data: { workspaceId: id, kind: "VOICE_SETTINGS", ...data },
          });
      });
      await db.auditLog.create({
        data: {
          actorId: user.id,
          action: "ASSISTANT_VOICE_ACTIVATION",
          entityType: "AssistantWorkspace",
          entityId: id,
        },
      });
      return NextResponse.json({ saved: true });
    }
    if (action === "approveVoice" || action === "deleteVoice") {
      const input = z
        .object({
          voiceRecordId: z.uuid(),
          reviewEvidence: z.string().trim().min(10).max(2000).optional(),
        })
        .strict()
        .parse(body);
      const voice = await db.assistantResource.findFirst({
        where: { id: input.voiceRecordId, workspaceId: id, kind: "VOICE" },
      });
      if (!voice?.externalId) throw new AssistantError("Voice not found.", 404);
      if (action === "approveVoice") {
        if (user.role !== "ADMIN" || !input.reviewEvidence)
          throw new AssistantError(
            "Administrator review of speaker authorization is required.",
            403,
          );
        const remote = await eleven(
            `/v1/voices/${providerId.parse(voice.externalId)}`,
          ),
          data = voice.data as Record<string, unknown>;
        if (
          data.requiresVerification &&
          remote.voice_verification?.is_verified !== true
        )
          throw new AssistantError(
            "Complete ElevenLabs voice verification first.",
          );
        await db.assistantResource.update({
          where: { id: voice.id },
          data: {
            status: "APPROVED",
            data: {
              ...data,
              reviewEvidence: input.reviewEvidence,
              approvedBy: user.id,
              approvedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        await db.assistantResource.update({
          where: { id: voice.id },
          data: { status: "REVOKED" },
        });
        await eleven(
          `/v1/voices/${providerId.parse(voice.externalId)}`,
          "DELETE",
        );
        await db.assistantResource.update({
          where: { id: voice.id },
          data: { status: "DELETED" },
        });
      }
      return NextResponse.json({ saved: true });
    }
    if (action === "prepare") {
      const input = z
        .object({ campaignId: z.uuid(), version: z.number().int().positive() })
        .strict()
        .parse(body);
      return NextResponse.json({
        agent: await prepareVoiceAgent(
          workspace,
          input.campaignId,
          input.version,
        ),
      });
    }
    if (action === "call") {
      const input = z
        .object({
          campaignId: z.uuid(),
          version: z.number().int().positive(),
          contactId: z.uuid(),
          confirmPaidCall: z.literal(true),
          audioConsentEvidence: z.string().trim().min(20).max(2000),
        })
        .strict()
        .parse(body);
      await startCallback(id, user.id, input);
      return NextResponse.json({
        message: "Call requested. Review the outcome in call history.",
      });
    }
    throw new AssistantError("Unknown voice action.", 404);
  } catch (error) {
    return assistantError(error);
  }
}
