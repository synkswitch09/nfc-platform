import { z } from "zod";
import { db } from "@/lib/db";
import { AssistantError } from "../http";
import { assistantAccess } from "../policy";
import { contentSchema } from "../growth/schema";
import { graph } from "../meta/graph";
import { openMeta, requireMeta } from "../meta/security";
export function publishingEnabled() {
  return process.env.AI_ASSISTANTS_META_PUBLISHING_ENABLED === "true";
}
export function validatePublication(
  data: ReturnType<typeof contentSchema.parse>,
) {
  if (data.caption.length > 2200 && data.channel === "INSTAGRAM")
    throw new AssistantError(
      "Instagram captions must be at most 2,200 characters.",
    );
  if (data.channel === "FACEBOOK" && data.format === "STORY")
    throw new AssistantError(
      "Facebook Stories can be planned and exported; direct publication is not supported yet.",
    );
  if (data.format === "CAROUSEL" && (data.mediaUrls.length < 2 || data.video))
    throw new AssistantError("Choose 2–10 image URLs for this carousel.");
  if (data.format !== "CAROUSEL" && data.mediaUrls.length > 1)
    throw new AssistantError("Choose one media URL or select Carousel.");
  if (data.format === "REEL" && (!data.video || data.mediaUrls.length !== 1))
    throw new AssistantError("A reel requires one video URL.");
  if (data.channel === "INSTAGRAM" && data.mediaUrls.length < 1)
    throw new AssistantError("Instagram requires approved media.");
  if (data.channel === "INSTAGRAM" && data.format === "POST" && data.video)
    throw new AssistantError("Choose Reel for Instagram video publishing.");
  if (data.channel === "FACEBOOK" && data.video && data.format !== "REEL")
    throw new AssistantError(
      "Choose Reel for direct Facebook video publishing.",
    );
  for (const value of data.mediaUrls) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes(".") ||
      /^\d[\d.]+$/.test(url.hostname) ||
      url.hostname.endsWith(".local") ||
      url.hostname.endsWith(".localhost")
    )
      throw new AssistantError(
        "Use a public HTTPS media URL without credentials or custom ports.",
      );
  }
}
export async function requestPublication(
  workspaceId: string,
  resourceId: string,
  version: number,
  schedule: boolean,
) {
  if (!publishingEnabled())
    throw new AssistantError(
      "Publishing needs administrator activation and Meta approval. Drafting remains available.",
      503,
    );
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
    const record = await tx.assistantResource.findFirst({
      where: {
        id: resourceId,
        workspaceId,
        kind: "CONTENT",
        version,
        status: "APPROVED",
      },
    });
    if (!record)
      throw new AssistantError(
        "Approve the current content version first.",
        409,
      );
    const data = contentSchema.parse(record.data);
    validatePublication(data);
    if (
      schedule &&
      (!data.scheduledAt || Date.parse(data.scheduledAt) < Date.now() + 60000)
    )
      throw new AssistantError(
        "Choose a publication time at least one minute in the future.",
      );
    const workspace = await tx.assistantWorkspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    if (!assistantAccess(workspace).active || workspace.pausedAt)
      throw new AssistantError("Active service is required.", 403);
    const connection = await tx.assistantSocialConnection.findFirst({
      where: { workspaceId, provider: data.channel, status: "CONNECTED" },
    });
    const scope =
      data.channel === "INSTAGRAM"
        ? "instagram_content_publish"
        : "pages_manage_posts";
    if (
      !connection?.tokenCiphertext ||
      !connection.grantedScopes.includes(scope)
    )
      throw new AssistantError(
        "Reconnect this channel with content publishing permission.",
        409,
      );
    const nextVersion = version + 1;
    await tx.assistantResource.update({
      where: { id: record.id },
      data: { status: schedule ? "SCHEDULED" : "QUEUED", version: nextVersion },
    });
    return tx.assistantResource.create({
      data: {
        workspaceId,
        kind: "PUBLISH_JOB",
        title: record.title,
        status: "READY",
        externalId: `${record.id}:${nextVersion}`,
        data: {
          contentId: record.id,
          contentVersion: nextVersion,
          connectionId: connection.id,
          step: "START",
          children: [],
        },
      },
    });
  });
}
type JobData = {
  contentId: string;
  contentVersion: number;
  connectionId: string;
  step: string;
  children: string[];
  mediaId?: string;
};
/** One durable phase per invocation. Ambiguous mutations stop instead of duplicating a post. */
export async function advancePublication(jobId: string) {
  const claim = await db.$transaction(async (tx) => {
    const locator = await tx.assistantResource.findUnique({
      where: { id: jobId },
    });
    if (!locator || locator.kind !== "PUBLISH_JOB") return null;
    await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${locator.workspaceId}::uuid FOR UPDATE`;
    const job = await tx.assistantResource.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "READY") return null;
    const details = job.data as unknown as JobData;
    const workspace = await tx.assistantWorkspace.findUniqueOrThrow({
        where: { id: job.workspaceId },
      }),
      content = await tx.assistantResource.findFirst({
        where: {
          id: details.contentId,
          workspaceId: job.workspaceId,
          version: details.contentVersion,
          status: { in: ["QUEUED", "SCHEDULED", "PROCESSING"] },
        },
      });
    if (!content) {
      await tx.assistantResource.update({
        where: { id: job.id },
        data: { status: "CANCELLED" },
      });
      return null;
    }
    if (
      !assistantAccess(workspace).active ||
      workspace.pausedAt ||
      !publishingEnabled()
    ) {
      await tx.assistantResource.update({
        where: { id: job.id },
        data: { status: "READY" },
      });
      return null;
    }
    const data = contentSchema.parse(content.data);
    if (
      content.status === "SCHEDULED" &&
      data.scheduledAt &&
      Date.parse(data.scheduledAt) > Date.now()
    ) {
      await tx.assistantResource.update({
        where: { id: job.id },
        data: { status: "READY" },
      });
      return null;
    }
    const connection = await tx.assistantSocialConnection.findFirst({
      where: {
        id: details.connectionId,
        workspaceId: job.workspaceId,
        status: "CONNECTED",
      },
    });
    if (
      !connection?.tokenCiphertext ||
      (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date())
    ) {
      await tx.assistantResource.update({
        where: { id: job.id },
        data: { status: "BLOCKED" },
      });
      return null;
    }
    if (
      !(
        await tx.assistantResource.updateMany({
          where: { id: job.id, status: "READY" },
          data: { status: "IN_FLIGHT" },
        })
      ).count
    )
      return null;
    return {
      job,
      details,
      content,
      data,
      connection,
      token: z
        .string()
        .parse(
          openMeta(connection.tokenCiphertext, `connection:${connection.id}`),
        ),
    };
  });
  if (!claim) return false;
  const { job, details, data, connection, token } = claim;
  const next = { ...details, children: [...details.children] };
  let publishedId: string | undefined;
  const getId = (value: unknown) =>
    z
      .string()
      .regex(/^\d+(?:_\d+)?$/)
      .parse(value);
  try {
    if (data.channel === "INSTAGRAM") {
      if (details.step === "START") {
        if (
          data.format === "CAROUSEL" &&
          next.children.length < data.mediaUrls.length
        ) {
          next.children.push(
            getId(
              (
                await graph(`${connection.accountId}/media`, token, "POST", {
                  image_url: data.mediaUrls[next.children.length],
                  is_carousel_item: true,
                })
              ).id,
            ),
          );
        } else {
          const params =
            data.format === "CAROUSEL"
              ? {
                  media_type: "CAROUSEL",
                  children: next.children,
                  caption: data.caption,
                }
              : data.format === "REEL"
                ? {
                    media_type: "REELS",
                    video_url: data.mediaUrls[0],
                    caption: data.caption,
                  }
                : data.format === "STORY"
                  ? {
                      media_type: "STORIES",
                      [data.video ? "video_url" : "image_url"]:
                        data.mediaUrls[0],
                    }
                  : { image_url: data.mediaUrls[0], caption: data.caption };
          next.mediaId = getId(
            (
              await graph(
                `${connection.accountId}/media`,
                token,
                "POST",
                params,
              )
            ).id,
          );
          next.step = "STATUS";
        }
      } else if (details.step === "STATUS") {
        const status = (
          await graph(details.mediaId!, token, "GET", { fields: "status_code" })
        ).status_code;
        if (status === "FINISHED") next.step = "FINAL";
        else if (["ERROR", "EXPIRED"].includes(status))
          throw new AssistantError(
            "Meta could not prepare the media. Review format and account restrictions.",
          );
        else if (status === "PUBLISHED")
          throw new AssistantError(
            "Container is already published; reconcile the external post before retrying.",
          );
      } else if (details.step === "FINAL")
        publishedId = getId(
          (
            await graph(
              `${connection.accountId}/media_publish`,
              token,
              "POST",
              { creation_id: details.mediaId },
            )
          ).id,
        );
    } else if (data.format === "REEL") {
      if (details.step === "START") {
        next.mediaId = getId(
          (
            await graph(`${connection.pageId}/video_reels`, token, "POST", {
              upload_phase: "start",
            })
          ).video_id,
        );
        next.step = "UPLOAD";
      } else if (details.step === "UPLOAD") {
        const response = await fetch(
          `https://rupload.facebook.com/video-upload/${requireMeta().version}/${getId(details.mediaId)}`,
          {
            method: "POST",
            headers: {
              authorization: `OAuth ${token}`,
              file_url: data.mediaUrls[0],
            },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok || (await response.json()).success !== true)
          throw new AssistantError("Meta video upload was not confirmed.");
        next.step = "STATUS";
      } else if (details.step === "STATUS") {
        const status = (
          await graph(details.mediaId!, token, "GET", { fields: "status" })
        ).status;
        if (
          status?.video_status === "ready" ||
          status?.processing_phase?.status === "complete"
        )
          next.step = "FINAL";
        else if (status?.video_status === "error")
          throw new AssistantError("Meta could not process this video.");
      } else if (details.step === "FINAL") {
        const result = await graph(
          `${connection.pageId}/video_reels`,
          token,
          "POST",
          {
            upload_phase: "finish",
            video_id: details.mediaId,
            video_state: "PUBLISHED",
            description: data.caption,
          },
        );
        if (result.success !== true)
          throw new AssistantError("Publication is unconfirmed.");
        publishedId =
          typeof result.post_id === "string"
            ? getId(result.post_id)
            : details.mediaId;
      }
    } else {
      if (next.children.length < data.mediaUrls.length)
        next.children.push(
          getId(
            (
              await graph(`${connection.pageId}/photos`, token, "POST", {
                url: data.mediaUrls[next.children.length],
                published: false,
              })
            ).id,
          ),
        );
      else
        publishedId = getId(
          (
            await graph(`${connection.pageId}/feed`, token, "POST", {
              message: data.caption,
              ...(next.children.length
                ? {
                    attached_media: next.children.map((media_fbid) => ({
                      media_fbid,
                    })),
                  }
                : {}),
            })
          ).id,
        );
    }
    await db.$transaction(async (tx) => {
      await tx.assistantResource.update({
        where: { id: job.id },
        data: {
          status: publishedId ? "PUBLISHED" : "READY",
          data: {
            ...next,
            ...(publishedId
              ? { publishedId, publishedAt: new Date().toISOString() }
              : {}),
          },
        },
      });
      await tx.assistantResource.updateMany({
        where: {
          id: details.contentId,
          version: details.contentVersion,
          status: { in: ["QUEUED", "SCHEDULED", "PROCESSING"] },
        },
        data: { status: publishedId ? "PUBLISHED" : "PROCESSING" },
      });
    });
    return true;
  } catch (error) {
    // Even provider 5xx or process loss can follow acceptance. No automatic mutation retry.
    await db.assistantResource.update({
      where: { id: job.id },
      data: {
        status: details.step === "STATUS" ? "REVIEW_REQUIRED" : "UNCERTAIN",
      },
    });
    await db.assistantResource.updateMany({
      where: { id: details.contentId, version: details.contentVersion },
      data: { status: "REVIEW_REQUIRED" },
    });
    throw error;
  }
}
export async function maintainPublications() {
  const start = Date.now(),
    jobs = await db.assistantResource.findMany({
      where: { kind: "PUBLISH_JOB", status: "READY" },
      take: 10,
      orderBy: { updatedAt: "asc" },
    });
  let advanced = 0;
  for (const job of jobs) {
    if (Date.now() - start > 15000) break;
    try {
      if (await advancePublication(job.id)) advanced++;
    } catch {
      /* History retains the unconfirmed phase for review; no provider payload is logged. */
    }
  }
  return advanced;
}
