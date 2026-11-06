import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  assistantWrite,
  ownedWorkspace,
  assistantError,
  AssistantError,
} from "@/lib/assistants/http";
import { boundedJson } from "@/lib/assistants/growth/body";
import {
  requestPublication,
  advancePublication,
  publishingEnabled,
} from "@/lib/assistants/content/publishing";
import { rateLimit } from "@/lib/rate-limit";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await ownedWorkspace(id);
    return NextResponse.json(
      {
        enabled: publishingEnabled(),
        jobs: await db.assistantResource.findMany({
          where: { workspaceId: id, kind: "PUBLISH_JOB" },
          take: 100,
          orderBy: { createdAt: "desc" },
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return assistantError(error);
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assistantWrite(request);
    const { id } = await params,
      { user } = await ownedWorkspace(id);
    if (!(await rateLimit("assistant-publishing", user.id, 10, 60000)).allowed)
      throw new AssistantError("Wait before publishing again.", 429);
    const input = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.enum(["publish", "schedule"]),
            resourceId: z.uuid(),
            version: z.number().int().positive(),
            confirm: z.literal(true),
          })
          .strict(),
        z.object({ action: z.literal("continue"), jobId: z.uuid() }).strict(),
      ])
      .parse(await boundedJson(request));
    if (input.action === "continue") {
      const job = await db.assistantResource.findFirst({
        where: {
          id: input.jobId,
          workspaceId: id,
          kind: "PUBLISH_JOB",
          status: "READY",
        },
      });
      if (!job)
        throw new AssistantError(
          "This job cannot be continued. Review its result first.",
          409,
        );
      await advancePublication(job.id);
    } else {
      const job = await requestPublication(
        id,
        input.resourceId,
        input.version,
        input.action === "schedule",
      );
      if (input.action === "publish")
        after(async () => {
          for (let step = 0; step < 3; step++) {
            try {
              if (!(await advancePublication(job.id))) break;
            } catch {
              break;
            }
          }
        });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    return assistantError(error);
  }
}
