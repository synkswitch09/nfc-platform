import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { boundedJson } from "@/lib/assistants/growth/body";
import { assistantError, AssistantError } from "@/lib/assistants/http";
import { secureEqual } from "@/lib/assistants/meta/security";
import { telegramSecret } from "@/lib/assistants/telegram/api";
import { processMetaQueue } from "@/lib/assistants/meta/queue";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const { connectionId } = await params;
    if (
      !z.uuid().safeParse(connectionId).success ||
      !secureEqual(
        request.headers.get("x-telegram-bot-api-secret-token") || "",
        telegramSecret(connectionId),
      )
    )
      throw new AssistantError("Invalid webhook secret.", 401);
    const input = z
      .object({
        update_id: z.number().int().nonnegative(),
        message: z
          .object({
            date: z.number().int(),
            text: z.string().max(4000).optional(),
            from: z.object({ is_bot: z.boolean() }).optional(),
            chat: z.object({
              id: z.number().int().positive(),
              type: z.string(),
            }),
          })
          .optional(),
      })
      .parse(await boundedJson(request));
    const message = input.message;
    if (
      !message?.text ||
      message.from?.is_bot ||
      message.chat.type !== "private"
    )
      return NextResponse.json({ received: true });
    const connection = await db.assistantSocialConnection.findFirst({
      where: { id: connectionId, provider: "TELEGRAM", status: "CONNECTED" },
    });
    if (!connection) return NextResponse.json({ received: true });
    const occurredAt = new Date(message.date * 1000);
    if (
      !Number.isFinite(occurredAt.getTime()) ||
      occurredAt.getTime() > Date.now() + 300000
    )
      throw new AssistantError("Invalid event time.");
    await db.assistantSocialEvent.createMany({
      data: [
        {
          connectionId,
          eventKey: `telegram:${input.update_id}`,
          kind: "MESSAGE",
          contactId: String(message.chat.id),
          targetId: String(message.chat.id),
          text: message.text,
          occurredAt,
        },
      ],
      skipDuplicates: true,
    });
    after(async () => {
      await processMetaQueue(2);
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    return assistantError(error);
  }
}
