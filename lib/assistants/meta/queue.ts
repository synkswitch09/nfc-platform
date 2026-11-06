import { isOptOut, recordOptOut } from "../growth/opt-out";
import { campaignContext, validateCampaignSend } from "../growth/campaigns";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Prisma,
  type AssistantWorkspace,
  type AssistantSocialConnection,
  type AssistantConversation,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { assistantConfig } from "../config";
import { AssistantError } from "../http";
import { assistantAccess } from "../policy";
import { assistantReply } from "../replies";
import { messageWindowOpen, needsHuman, parseMetaEvents } from "./events";
import { MetaGraphError, sendMetaReply } from "./graph";
import { parseWhatsApp } from "./whatsapp-events";
import { metaConfig, openMeta, whatsAppConfig } from "./security";
type Event = Prisma.AssistantSocialEventGetPayload<{
  include: { connection: { include: { workspace: true } } };
}>;
export function socialCanReply(
  workspace: AssistantWorkspace,
  connection: AssistantSocialConnection,
  conversation: AssistantConversation,
  kind: string,
  manual = false,
) {
  const access = assistantAccess(workspace);
  return (
    assistantConfig().launchEnabled &&
    metaConfig().ready &&
    (connection.provider !== "WHATSAPP" || whatsAppConfig().ready) &&
    access.active &&
    workspace.channels.length <= access.channels &&
    Boolean(workspace.knowledgeApprovedAt) &&
    workspace.channels.includes(connection.provider) &&
    (access.reason !== "trial" ||
      workspace.trialChannel === connection.provider) &&
    connection.status === "CONNECTED" &&
    Boolean(connection.tokenCiphertext) &&
    (!connection.tokenExpiresAt || connection.tokenExpiresAt > new Date()) &&
    (manual ||
      (connection.enabled &&
        !conversation.humanOnly &&
        (kind === "COMMENT"
          ? connection.autoComments
          : connection.autoMessages))) &&
    (connection.provider === "TELEGRAM" ||
      kind === "COMMENT" ||
      messageWindowOpen(conversation.lastCustomerMessageAt))
  );
}
export async function receiveMetaEvents(payload: unknown) {
  const whatsapp = Boolean(
    payload &&
      typeof payload === "object" &&
      "object" in payload &&
      payload.object === "whatsapp_business_account",
  );
  const parsed = whatsapp
    ? parseWhatsApp(payload)
    : { events: parseMetaEvents(payload), updates: [] };
  if (whatsapp && !whatsAppConfig().ready) return 0;
  for (const update of parsed.updates) {
    if (
      !Number.isFinite(update.occurredAt.getTime()) ||
      update.occurredAt.getTime() > Date.now() + 5 * 60000
    )
      continue;
    const connections = await db.assistantSocialConnection.findMany({
      where: { provider: "WHATSAPP", whatsAppAccountId: update.wabaId },
    });
    for (const connection of connections) {
      await db.assistantSocialEvent.createMany({
        data: [
          {
            connectionId: connection.id,
            eventKey: `account:${update.event}:${update.occurredAt.getTime()}`,
            kind: "ACCOUNT",
            contactId: "0",
            targetId: update.wabaId,
            text: update.event,
            occurredAt: update.occurredAt,
          },
        ],
        skipDuplicates: true,
      });
      if (
        update.occurredAt.getTime() >=
        connection.connectedAt.getTime() - 1000
      )
        await db.assistantSocialConnection.updateMany({
          where: {
            id: connection.id,
            connectedAt: { lte: new Date(update.occurredAt.getTime() + 1000) },
          },
          data: { enabled: false },
        });
    }
  }
  let received = 0;
  for (const event of parsed.events) {
    const connection = await db.assistantSocialConnection.findUnique({
      where: {
        provider_accountId: {
          provider: event.provider,
          accountId: event.accountId,
        },
      },
    });
    if (
      !connection ||
      connection.status !== "CONNECTED" ||
      event.contactId === connection.pageId ||
      (event.provider === "WHATSAPP" &&
        connection.whatsAppAccountId !== event.scopeId)
    )
      continue;
    // Old/replayed notifications are retained for human review, never answered.
    if (
      !Number.isFinite(event.occurredAt.getTime()) ||
      event.occurredAt.getTime() > Date.now() + 5 * 60000
    )
      continue;
    const stored = await db.assistantSocialEvent.createMany({
      data: [
        {
          connectionId: connection.id,
          eventKey: event.eventKey,
          kind: event.kind,
          contactId: event.contactId,
          targetId: event.targetId,
          text: event.text,
          occurredAt: event.occurredAt,
        },
      ],
      skipDuplicates: true,
    });
    received += stored.count;
  }
  return received;
}
async function conversationFor(event: Event) {
  const thread =
    event.kind === "COMMENT"
      ? `comment:${event.targetId}`
      : `dm:${event.contactId}`;
  const conversation = await db.assistantConversation.upsert({
    where: {
      socialConnectionId_externalThreadId: {
        socialConnectionId: event.connectionId,
        externalThreadId: thread,
      },
    },
    create: {
      workspaceId: event.connection.workspaceId,
      socialConnectionId: event.connectionId,
      externalThreadId: thread,
      tokenHash: sha256(createOpaqueToken()),
      channel:
        event.kind === "COMMENT"
          ? `${event.connection.provider}_COMMENT`
          : event.connection.provider,
    },
    update: { updatedAt: new Date() },
  });
  if (event.kind === "ECHO") return conversation;
  if (event.kind !== "COMMENT")
    await db.assistantConversation.updateMany({
      where: {
        id: conversation.id,
        OR: [
          { lastCustomerMessageAt: null },
          { lastCustomerMessageAt: { lt: event.occurredAt } },
        ],
      },
      data: { lastCustomerMessageAt: event.occurredAt },
    });
  await db.assistantMessage.upsert({
    where: {
      conversationId_requestId: {
        conversationId: conversation.id,
        requestId: event.eventKey,
      },
    },
    create: {
      conversationId: conversation.id,
      requestId: event.eventKey,
      role: "USER",
      text: event.text,
      createdAt: event.occurredAt,
    },
    update: {},
  });
  if (
    event.kind === "HANDOFF" ||
    needsHuman(event.text) ||
    isOptOut(event.text) ||
    event.text.length > 4000
  )
    await db.assistantConversation.update({
      where: { id: conversation.id },
      data: { humanOnly: true },
    });
  if (isOptOut(event.text))
    await recordOptOut(event.connection.workspaceId, conversation.id);
  return db.assistantConversation.findUniqueOrThrow({
    where: { id: conversation.id },
  });
}
async function lockDelivery(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  connectionId: string,
  conversationId: string,
) {
  // Serialize with pause/disconnect and human takeover. The bounded external
  // send occurs under these locks; generation never holds a DB transaction.
  await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "AssistantSocialConnection" WHERE id=${connectionId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "AssistantConversation" WHERE id=${conversationId}::uuid FOR UPDATE`;
  return {
    workspace: await tx.assistantWorkspace.findUniqueOrThrow({
      where: { id: workspaceId },
    }),
    connection: await tx.assistantSocialConnection.findUniqueOrThrow({
      where: { id: connectionId },
    }),
    conversation: await tx.assistantConversation.findUniqueOrThrow({
      where: { id: conversationId },
    }),
  };
}
async function processEvent(event: Event, leaseToken: string) {
  if (event.kind === "ACCOUNT") {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${event.connection.workspaceId}::uuid FOR UPDATE`;
      const current = await tx.assistantSocialConnection.findUnique({
        where: { id: event.connectionId },
      });
      if (!current) return;
      if (event.occurredAt.getTime() < current.connectedAt.getTime() - 1000) {
        await tx.assistantSocialEvent.update({
          where: { id: event.id },
          data: {
            status: "SKIPPED",
            leaseUntil: null,
            errorCode: "OLD_ACCOUNT_EVENT",
          },
        });
        return;
      }
      if (["PARTNER_APP_UNINSTALLED", "ACCOUNT_DELETED"].includes(event.text)) {
        await tx.assistantSocialConnection.delete({
          where: { id: current.id },
        });
        const workspace = await tx.assistantWorkspace.findUniqueOrThrow({
          where: { id: current.workspaceId },
        });
        if (
          !(await tx.assistantSocialConnection.count({
            where: {
              workspaceId: current.workspaceId,
              provider: "WHATSAPP",
              status: { in: ["CONNECTED", "REAUTH_REQUIRED"] },
            },
          }))
        )
          await tx.assistantWorkspace.update({
            where: { id: workspace.id },
            data: {
              channels: workspace.channels.filter((c) => c !== "WHATSAPP"),
            },
          });
        return;
      }
      await tx.assistantSocialConnection.update({
        where: { id: current.id },
        data: {
          enabled: false,
          status: "REAUTH_REQUIRED",
          tokenCiphertext: null,
          autoMessages: false,
          autoComments: false,
          lastError:
            "WhatsApp access changed in Meta. Reconnect the number to restore replies.",
        },
      });
      await tx.assistantSocialEvent.update({
        where: { id: event.id },
        data: {
          status: "SKIPPED",
          leaseUntil: null,
          errorCode: "ACCOUNT_ACCESS_CHANGED",
        },
      });
    });
    return;
  }
  if (event.kind === "DELIVERY") {
    const later =
      event.text === "SENT"
        ? ["DELIVERED", "READ", "FAILED"]
        : event.text === "DELIVERED"
          ? ["READ", "FAILED"]
          : event.text === "FAILED"
            ? ["DELIVERED", "READ"]
            : [];
    await db.assistantMessage.updateMany({
      where: {
        externalId: event.targetId,
        conversation: { socialConnectionId: event.connectionId },
        OR: [{ deliveryStatus: null }, { deliveryStatus: { notIn: later } }],
      },
      data: { deliveryStatus: event.text },
    });
    if (["DELIVERED", "READ"].includes(event.text))
      await db.assistantSocialEvent.updateMany({
        where: {
          connectionId: event.connectionId,
          externalReplyId: event.targetId,
          errorCode: "WHATSAPP_DELIVERY_FAILED",
        },
        data: { errorCode: null },
      });
    if (event.text === "FAILED")
      await db.assistantSocialEvent.updateMany({
        where: {
          connectionId: event.connectionId,
          externalReplyId: event.targetId,
          status: "SENT",
        },
        data: { errorCode: "WHATSAPP_DELIVERY_FAILED" },
      });
    await db.assistantSocialEvent.update({
      where: { id: event.id },
      data: {
        status: "SKIPPED",
        leaseUntil: null,
        errorCode:
          event.text === "FAILED"
            ? "WHATSAPP_DELIVERY_FAILED"
            : "DELIVERY_STATUS",
      },
    });
    return;
  }

  // Identity can be scoped differently across Meta surfaces. Also recognise
  // our confirmed outbound comment IDs instead of relying only on actor IDs.
  if (
    event.kind === "COMMENT" &&
    ((await db.assistantSocialEvent.count({
      where: {
        connectionId: event.connectionId,
        externalReplyId: event.targetId,
      },
    })) ||
      (await db.assistantMessage.count({
        where: {
          externalId: event.targetId,
          conversation: { socialConnectionId: event.connectionId },
        },
      })))
  ) {
    await db.assistantSocialEvent.update({
      where: { id: event.id },
      data: { status: "SKIPPED", errorCode: "OWN_COMMENT", leaseUntil: null },
    });
    return;
  }
  const conversation = await conversationFor(event);
  if (event.kind === "ECHO") {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AssistantConversation" WHERE id=${conversation.id}::uuid FOR UPDATE`;
      const external = event.eventKey.slice("message:".length);
      const ours = await tx.assistantSocialEvent.count({
        where: { connectionId: event.connectionId, externalReplyId: external },
      });
      const manual = await tx.assistantMessage.count({
        where: { conversationId: conversation.id, externalId: external },
      });
      if (!ours && !manual) {
        await tx.assistantConversation.update({
          where: { id: conversation.id },
          data: { humanOnly: true },
        });
        await tx.assistantMessage.upsert({
          where: {
            conversationId_requestId: {
              conversationId: conversation.id,
              requestId: event.eventKey,
            },
          },
          create: {
            conversationId: conversation.id,
            requestId: event.eventKey,
            role: "ASSISTANT",
            text: event.text,
          },
          update: {},
        });
      }
    });
    await db.assistantSocialEvent.update({
      where: { id: event.id },
      data: { status: "SKIPPED", errorCode: "ECHO", leaseUntil: null },
    });
    return;
  }
  if (
    !socialCanReply(
      event.connection.workspace,
      event.connection,
      conversation,
      event.kind,
    ) ||
    !messageWindowOpen(event.occurredAt)
  ) {
    await db.assistantSocialEvent.update({
      where: { id: event.id },
      data: {
        status: "SKIPPED",
        errorCode: conversation.humanOnly
          ? "HUMAN_REVIEW"
          : "REPLIES_DISABLED_OR_WINDOW_CLOSED",
        leaseUntil: null,
      },
    });
    return;
  }
  const leaseUntil = new Date(Date.now() + 90000);
  if (
    !(
      await db.assistantConversation.updateMany({
        where: {
          id: conversation.id,
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
        },
        data: { lockedUntil: leaseUntil },
      })
    ).count
  ) {
    await db.assistantSocialEvent.update({
      where: { id: event.id },
      data: { status: "PENDING", leaseUntil: null },
    });
    return;
  }
  try {
    let reply = event.replyText;
    if (!reply) {
      const history = await db.assistantMessage.findMany({
        where: { conversationId: conversation.id, status: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      const context = await campaignContext(
        event.connection.workspace,
        conversation.id,
      );
      if (!context.allowed)
        throw new AssistantError("Campaign is paused or requires review.", 409);
      reply = await assistantReply(
        context.workspace,
        history.reverse().map((m) => ({
          role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
        false,
        event.kind === "COMMENT"
          ? "public-comment"
          : event.connection.provider === "WHATSAPP"
            ? "whatsapp-message"
            : "social-message",
      );
      if (reply.length > 990)
        throw new AssistantError("Generated answer needs human review.");
      if (
        !(
          await db.assistantSocialEvent.updateMany({
            where: { id: event.id, leaseToken, status: "GENERATING" },
            data: { replyText: reply, status: "READY" },
          })
        ).count
      )
        return;
    }
    // SENDING is a durable fence. A crash or timeout after this point is never
    // retried automatically: Meta may have accepted the external message.
    if (
      !(
        await db.assistantSocialEvent.updateMany({
          where: { id: event.id, leaseToken, status: "READY" },
          data: { status: "SENDING" },
        })
      ).count
    )
      return;
    try {
      await db.$transaction(
        async (tx) => {
          const current = await lockDelivery(
            tx,
            event.connection.workspaceId,
            event.connectionId,
            conversation.id,
          );
          if (
            !socialCanReply(
              current.workspace,
              current.connection,
              current.conversation,
              event.kind,
            ) ||
            !messageWindowOpen(event.occurredAt)
          ) {
            await tx.assistantSocialEvent.update({
              where: { id: event.id },
              data: {
                status: "SKIPPED",
                errorCode: "REPLIES_PAUSED",
                leaseUntil: null,
              },
            });
            return;
          }
          if (
            !(await campaignContext(current.workspace, conversation.id, tx))
              .allowed
          )
            throw new AssistantError("Campaign requires review.", 409);
          const token = z
              .string()
              .parse(
                openMeta(
                  current.connection.tokenCiphertext!,
                  `connection:${current.connection.id}`,
                ),
              ),
            externalReplyId = await sendMetaReply(
              current.connection,
              token,
              event.kind,
              event.targetId,
              reply!,
            );
          await tx.assistantMessage.create({
            data: {
              conversationId: conversation.id,
              requestId: `reply:${event.id}`,
              role: "ASSISTANT",
              text: reply!,
              externalId: externalReplyId,
              deliveryStatus:
                current.connection.provider === "WHATSAPP" ? "ACCEPTED" : null,
            },
          });
          await tx.assistantSocialEvent.update({
            where: { id: event.id },
            data: { status: "SENT", externalReplyId, leaseUntil: null },
          });
          await tx.assistantConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (error) {
      await failEvent(event, error, true);
    }
  } catch (error) {
    await failEvent(event, error, false);
  } finally {
    await db.assistantConversation.updateMany({
      where: { id: conversation.id, lockedUntil: leaseUntil },
      data: { lockedUntil: null },
    });
  }
}
async function failEvent(event: Event, error: unknown, sending: boolean) {
  const uncertain =
      sending && (!(error instanceof MetaGraphError) || error.uncertain),
    code = error instanceof MetaGraphError ? error.code : 0;
  if (
    event.connection.provider === "WHATSAPP" &&
    error instanceof MetaGraphError &&
    [131042, 131031].includes(code)
  )
    await db.assistantSocialConnection.updateMany({
      where: { id: event.connectionId },
      data: { enabled: false, lastError: error.message },
    });
  await db.assistantSocialEvent.updateMany({
    where: { id: event.id, status: { in: ["GENERATING", "READY", "SENDING"] } },
    data: {
      status: uncertain ? "UNCERTAIN" : "FAILED",
      errorCode: uncertain
        ? "CHECK_META_BEFORE_RESENDING"
        : code === 190
          ? "RECONNECT_REQUIRED"
          : "HUMAN_REVIEW",
      leaseUntil: null,
    },
  });
  if (code === 190)
    await db.assistantSocialConnection.updateMany({
      where: { id: event.connectionId },
      data: {
        status: "REAUTH_REQUIRED",
        autoMessages: false,
        autoComments: false,
        lastError:
          "Meta access expired or was revoked. Reconnect this account.",
      },
    });
  await db.assistantConversation.updateMany({
    where: {
      socialConnectionId: event.connectionId,
      externalThreadId:
        event.kind === "COMMENT"
          ? `comment:${event.targetId}`
          : `dm:${event.contactId}`,
    },
    data: { humanOnly: true },
  });
}
export async function processMetaQueue(limit = 3) {
  if (!metaConfig().ready || !assistantConfig().launchEnabled)
    return { processed: 0 };
  const now = new Date();
  await db.assistantMetaFlow.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.assistantSocialEvent.updateMany({
    where: { status: "SENDING", leaseUntil: { lt: now } },
    data: {
      status: "UNCERTAIN",
      errorCode: "CHECK_META_BEFORE_RESENDING",
      leaseUntil: null,
    },
  });
  await db.assistantSocialEvent.updateMany({
    where: { status: "GENERATING", leaseUntil: { lt: now } },
    data: {
      status: "FAILED",
      errorCode: "GENERATION_INTERRUPTED",
      leaseUntil: null,
    },
  });
  const events = await db.assistantSocialEvent.findMany({
    where: {
      status: { in: ["PENDING", "READY"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    include: { connection: { include: { workspace: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const event of events) {
    const leaseToken = randomUUID();
    if (
      !(
        await db.assistantSocialEvent.updateMany({
          where: {
            id: event.id,
            status: event.status,
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
          },
          data: {
            leaseToken,
            leaseUntil: new Date(Date.now() + 90000),
            status: event.replyText ? "READY" : "GENERATING",
          },
        })
      ).count
    )
      continue;
    try {
      await processEvent(event, leaseToken);
    } catch (error) {
      await failEvent(event, error, false);
    }
    processed++;
  }
  return { processed };
}
export async function sendSocialManualReply(
  workspaceId: string,
  conversationId: string,
  text: string,
  requestId: string,
  campaign?: { campaignId: string; version: number; contactId: string },
) {
  if (text.length > 990)
    throw new AssistantError("Social replies must be at most 990 characters.");
  const conversation = await db.assistantConversation.findFirst({
    where: { id: conversationId, workspaceId },
  });
  if (!conversation?.socialConnectionId || !conversation.externalThreadId)
    throw new AssistantError("Conversation not found.", 404);
  // Persist the attempt before any network call; duplicate submits cannot send twice.
  if (!campaign)
    await db.assistantConversation.update({
      where: { id: conversationId },
      data: { humanOnly: true },
    });
  const key = `manual:${requestId}`,
    prior = await db.assistantMessage.findUnique({
      where: { conversationId_requestId: { conversationId, requestId: key } },
    });
  if (prior) {
    if (prior.status !== "COMPLETE")
      throw new AssistantError(
        "This reply was already attempted. Check Meta before sending again.",
        409,
      );
    return;
  }
  let outgoing;
  try {
    outgoing = await db.assistantMessage.create({
      data: {
        conversationId,
        requestId: key,
        role: "ASSISTANT",
        text,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AssistantError("This reply was already submitted.", 409);
    throw error;
  }
  let attempted = false;
  try {
    await db.$transaction(
      async (tx) => {
        const current = await lockDelivery(
            tx,
            workspaceId,
            conversation.socialConnectionId!,
            conversationId,
          ),
          kind = conversation.channel.endsWith("_COMMENT")
            ? "COMMENT"
            : "MESSAGE";
        if (
          !socialCanReply(
            current.workspace,
            current.connection,
            current.conversation,
            kind,
            true,
          )
        )
          throw new AssistantError(
            "Replies are paused or the 24-hour reply window has closed. Reply directly in Meta.",
            409,
          );
        if (campaign) {
          await validateCampaignSend(tx, workspaceId, conversationId, campaign);
          if (
            current.conversation.humanOnly ||
            !current.connection.enabled ||
            !current.connection.autoMessages ||
            kind !== "MESSAGE"
          )
            throw new AssistantError(
              "Restore automatic private replies before starting this campaign.",
              409,
            );
        }
        attempted = true;
        const target = conversation.externalThreadId!.slice(
            kind === "COMMENT" ? 8 : 3,
          ),
          external = await sendMetaReply(
            current.connection,
            z
              .string()
              .parse(
                openMeta(
                  current.connection.tokenCiphertext!,
                  `connection:${current.connection.id}`,
                ),
              ),
            kind,
            target,
            text,
          );
        await tx.assistantMessage.update({
          where: { id: outgoing.id },
          data: {
            status: "COMPLETE",
            externalId: external,
            deliveryStatus:
              current.connection.provider === "WHATSAPP" ? "ACCEPTED" : null,
          },
        });
        await tx.assistantConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      },
      { timeout: 20000, maxWait: 5000 },
    );
  } catch (error) {
    await db.assistantMessage.updateMany({
      where: { id: outgoing.id },
      data: {
        status:
          attempted && (!(error instanceof MetaGraphError) || error.uncertain)
            ? "UNCERTAIN"
            : "FAILED",
      },
    });
    throw error;
  }
}
