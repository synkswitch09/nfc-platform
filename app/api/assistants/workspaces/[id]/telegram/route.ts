import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  assistantWrite,
  ownedWorkspace,
  assistantError,
  AssistantError,
} from "@/lib/assistants/http";
import { boundedJson } from "@/lib/assistants/growth/body";
import { assistantUrl } from "@/lib/assistants/config";
import { assistantChannelLimit } from "@/lib/assistants/policy";
import { openMeta, sealMeta } from "@/lib/assistants/meta/security";
import { telegram, telegramSecret } from "@/lib/assistants/telegram/api";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assistantWrite(request);
    const { id } = await params,
      { user } = await ownedWorkspace(id);
    if (!(await rateLimit("telegram-connection", user.id, 10, 60000)).allowed)
      throw new AssistantError("Wait before changing this connection.", 429);
    const input = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("connect"),
            token: z.string().max(150),
            replaceWebhook: z.boolean().default(false),
          })
          .strict(),
        z
          .object({
            action: z.literal("toggle"),
            connectionId: z.uuid(),
            enabled: z.boolean(),
          })
          .strict(),
        z
          .object({ action: z.literal("disconnect"), connectionId: z.uuid() })
          .strict(),
      ])
      .parse(await boundedJson(request));
    if (input.action === "connect") {
      const bot = z
        .object({
          id: z.number().int().positive(),
          username: z.string(),
          is_bot: z.literal(true),
        })
        .parse(await telegram(input.token, "getMe"));
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`telegram:${bot.id}`}))`;
          await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${id}::uuid FOR UPDATE`;
          const workspace = await tx.assistantWorkspace.findUniqueOrThrow({
              where: { id },
            }),
            existing = await tx.assistantSocialConnection.findUnique({
              where: {
                provider_accountId: {
                  provider: "TELEGRAM",
                  accountId: String(bot.id),
                },
              },
            });
          if (existing && existing.workspaceId !== id)
            throw new AssistantError(
              "This bot belongs to another business.",
              409,
            );
          if (
            !workspace.channels.includes("TELEGRAM") &&
            workspace.channels.length >= assistantChannelLimit(workspace)
          )
            throw new AssistantError(
              "Your plan has no available channel slots.",
            );
          const connectionId = existing?.id || randomUUID();
          if (
            await tx.assistantSocialConnection.count({
              where: {
                workspaceId: id,
                provider: "TELEGRAM",
                id: { not: connectionId },
              },
            })
          )
            throw new AssistantError("Disconnect the current bot first.");
          const url = assistantUrl(`/api/assistants/telegram/${connectionId}`),
            hook = await telegram(input.token, "getWebhookInfo");
          if (hook.url && hook.url !== url && !input.replaceWebhook)
            throw new AssistantError(
              "This bot is connected elsewhere. Confirm replacing its webhook.",
              409,
            );
          const data = {
            tokenCiphertext: sealMeta(
              input.token,
              `connection:${connectionId}`,
            ),
            status: "CONNECTED",
            enabled: false,
            autoMessages: false,
          };
          await telegram(input.token, "setWebhook", {
            url,
            secret_token: telegramSecret(connectionId),
            allowed_updates: ["message"],
            drop_pending_updates: false,
          });
          await tx.assistantSocialConnection.upsert({
            where: { id: connectionId },
            create: {
              id: connectionId,
              workspaceId: id,
              provider: "TELEGRAM",
              accountId: String(bot.id),
              pageId: String(bot.id),
              displayName: `@${bot.username}`,
              authorizingUserId: user.id,
              ...data,
            },
            update: data,
          });
          await tx.assistantWorkspace.update({
            where: { id },
            data: {
              channels: [...new Set([...workspace.channels, "TELEGRAM"])],
            },
          });
        },
        { timeout: 35000 },
      );
    } else {
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${id}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "AssistantSocialConnection" WHERE id=${input.connectionId}::uuid FOR UPDATE`;
          const c = await tx.assistantSocialConnection.findFirst({
            where: {
              id: input.connectionId,
              workspaceId: id,
              provider: "TELEGRAM",
            },
          });
          if (!c) throw new AssistantError("Connection not found.", 404);
          if (input.action === "toggle")
            await tx.assistantSocialConnection.update({
              where: { id: c.id },
              data: { enabled: input.enabled, autoMessages: input.enabled },
            });
          else {
            if (c.tokenCiphertext)
              await telegram(
                z
                  .string()
                  .parse(openMeta(c.tokenCiphertext, `connection:${c.id}`)),
                "deleteWebhook",
              );
            await tx.assistantSocialConnection.delete({ where: { id: c.id } });
            const w = await tx.assistantWorkspace.findUniqueOrThrow({
              where: { id },
            });
            await tx.assistantWorkspace.update({
              where: { id },
              data: { channels: w.channels.filter((v) => v !== "TELEGRAM") },
            });
          }
        },
        { timeout: 20000 },
      );
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    return assistantError(error);
  }
}
