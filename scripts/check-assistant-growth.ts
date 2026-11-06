import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { sealMeta } from "../lib/assistants/meta/security";
import {
  requestPublication,
  advancePublication,
} from "../lib/assistants/content/publishing";
import { startCallback } from "../lib/assistants/voice/calls";
import {
  contactSchema,
  campaignSchema,
  contentSchema,
} from "../lib/assistants/growth/schema";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    process.env.CI !== "true" ||
    process.env.APP_ENV !== "development" ||
    url.hostname !== "localhost" ||
    url.pathname !== "/nfc_platform"
  )
    throw new Error("Only the disposable CI database is allowed");
  Object.assign(process.env, {
    AI_ASSISTANTS_ENABLED: "true",
    AI_ASSISTANTS_META_ENABLED: "true",
    AI_ASSISTANTS_META_APP_ID: "123456",
    AI_ASSISTANTS_META_APP_SECRET: "ci-secret-not-real-long",
    AI_ASSISTANTS_META_VERIFY_TOKEN: "ci-verify-token-at-least-32-characters",
    AI_ASSISTANTS_META_TOKEN_KEY: "ci-encryption-key-at-least-32-characters",
    AI_ASSISTANTS_META_PUBLISHING_ENABLED: "true",
    AI_ASSISTANTS_VOICE_ENABLED: "true",
    ELEVENLABS_API_KEY: "ci-not-real",
    ELEVENLABS_WEBHOOK_SECRET: "ci-webhook-not-real",
  });
  const original = globalThis.fetch;
  let ownerId = "",
    workspaceId = "",
    otherId = "",
    posts = 0,
    calls = 0;
  const now = new Date("2026-11-09T01:30:00Z");
  globalThis.fetch = async (input, init) => {
    const endpoint = new URL(String(input));
    if (endpoint.hostname === "api.elevenlabs.io") {
      assert.equal(endpoint.pathname, "/v1/convai/twilio/outbound-call");
      calls++;
      return Response.json({
        success: true,
        conversation_id: `conv_${calls}`,
        callSid: `sid_${calls}`,
      });
    }
    assert.equal(endpoint.hostname, "graph.facebook.com");
    assert.equal(init?.method, "POST");
    assert.match(endpoint.pathname, /\/12345\/feed$/);
    posts++;
    return Response.json({ id: `12345_${posts}` });
  };
  try {
    const owner = await db.user.create({
      data: {
        email: `growth-ci-${randomUUID()}@example.test`,
        name: "Growth CI",
        emailVerifiedAt: new Date(),
      },
    });
    ownerId = owner.id;
    const a = await db.assistantWorkspace.create({
        data: {
          ownerId,
          name: "Growth A",
          billingExempt: true,
          channels: ["WEB", "FACEBOOK"],
          knowledgeApprovedAt: now,
          publishedKnowledge: "Approved services",
        },
      }),
      b = await db.assistantWorkspace.create({
        data: { ownerId, name: "Growth B", billingExempt: true },
      });
    workspaceId = a.id;
    otherId = b.id;
    assert.equal(a.preferredLanguage, "en");
    assert.equal(a.timeZone, "Australia/Adelaide");
    const connectionId = randomUUID();
    await db.assistantSocialConnection.create({
      data: {
        id: connectionId,
        workspaceId: a.id,
        provider: "FACEBOOK",
        accountId: "12345",
        pageId: "12345",
        displayName: "CI Page",
        authorizingUserId: "9000",
        grantedScopes: ["pages_manage_posts"],
        tokenCiphertext: sealMeta("ci-token", `connection:${connectionId}`),
      },
    });
    const content = await db.assistantResource.create({
      data: {
        workspaceId: a.id,
        kind: "CONTENT",
        title: "CI post",
        status: "APPROVED",
        data: contentSchema.parse({
          format: "POST",
          channel: "FACEBOOK",
          brief: "Intro",
          caption: "Hello",
        }),
      },
    });
    await assert.rejects(() => requestPublication(b.id, content.id, 1, false));
    assert.equal(posts, 0);
    const jobs = await Promise.allSettled([
      requestPublication(a.id, content.id, 1, false),
      requestPublication(a.id, content.id, 1, false),
    ]);
    assert.equal(jobs.filter((r) => r.status === "fulfilled").length, 1);
    const job = await db.assistantResource.findFirstOrThrow({
      where: { workspaceId: a.id, kind: "PUBLISH_JOB" },
    });
    await Promise.all([advancePublication(job.id), advancePublication(job.id)]);
    assert.equal(posts, 1);
    assert.equal(
      (
        await db.assistantResource.findUniqueOrThrow({
          where: { id: content.id },
        })
      ).status,
      "PUBLISHED",
    );
    await advancePublication(job.id);
    assert.equal(posts, 1);
    const second = await db.assistantResource.create({
      data: {
        workspaceId: a.id,
        kind: "CONTENT",
        title: "Paused scheduled post",
        status: "APPROVED",
        data: contentSchema.parse(content.data),
      },
    });
    const cancelled = await requestPublication(a.id, second.id, 1, false);
    await db.assistantResource.update({
      where: { id: second.id },
      data: { status: "PAUSED", version: { increment: 1 } },
    });
    await advancePublication(cancelled.id);
    assert.equal(posts, 1);
    assert.equal(
      (
        await db.assistantResource.findUniqueOrThrow({
          where: { id: cancelled.id },
        })
      ).status,
      "CANCELLED",
    );
    const contact = await db.assistantResource.create({
      data: {
        workspaceId: a.id,
        kind: "CONTACT",
        title: "Opt-in contact",
        data: contactSchema.parse({
          name: "Opt-in contact",
          phone: "+61412345678",
          consent: {
            channel: "VOICE",
            evidence: "Explicit request in website form",
            at: "2026-11-08T00:00:00Z",
            expiresAt: null,
          },
        }),
      },
    });
    await db.assistantResource.create({
      data: {
        workspaceId: a.id,
        kind: "VOICE_SETTINGS",
        title: "Activation",
        status: "ACTIVE",
        data: {
          phoneNumberId: "line_1",
          enabled: true,
          monthlyMinuteLimit: 3,
          legalReviewUntil: "2026-12-01T00:00:00Z",
          holidayCalendarUntil: "2026-12-31",
          holidays: [],
          reviewEvidence: "Reviewed consent and local rules",
        },
      },
    });
    const secondContact = await db.assistantResource.create({
      data: {
        workspaceId: a.id,
        kind: "CONTACT",
        title: "Second callback",
        data: contactSchema.parse({
          name: "Second callback",
          phone: "+61412345679",
          consent: {
            channel: "VOICE",
            evidence: "Explicit request in website form",
            at: "2026-11-08T00:00:00Z",
            expiresAt: null,
          },
        }),
      },
    });
    const campaign = await db.assistantResource.create({
      data: {
        workspaceId: a.id,
        kind: "CAMPAIGN",
        title: "CI callback",
        status: "APPROVED",
        data: campaignSchema.parse({
          objective: "Return requested product enquiry",
          channel: "VOICE",
          contactIds: [contact.id, secondContact.id],
          maxCalls: 10,
          voiceId: "standard_voice",
        }),
      },
    });
    await db.assistantResource.create({
      data: {
        workspaceId: a.id,
        kind: "VOICE_AGENT",
        title: "CI agent",
        status: "READY",
        externalId: `${campaign.id}:1`,
        data: { agentId: "agent_1", voiceId: "standard_voice" },
      },
    });
    const input = {
      campaignId: campaign.id,
      version: 1,
      contactId: contact.id,
      audioConsentEvidence:
        "Explicit consent to AI audio processing and transcript retention",
    };
    const results = await Promise.allSettled([
      startCallback(a.id, ownerId, input, now),
      startCallback(a.id, ownerId, input, now),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(calls, 1);
    await assert.rejects(() =>
      startCallback(
        a.id,
        ownerId,
        { ...input, contactId: secondContact.id },
        now,
      ),
    );
    assert.equal(calls, 1);
    await assert.rejects(() => startCallback(b.id, ownerId, input, now));
    assert.equal(calls, 1);
    const resource = await db.assistantResource.findFirstOrThrow({
      where: { workspaceId: a.id, kind: "CALL" },
    });
    assert.equal(
      (resource.data as { reservedMinutes: number }).reservedMinutes,
      3,
    );
    await db.assistantWorkspace.delete({ where: { id: a.id } });
    workspaceId = "";
    assert.equal(
      await db.assistantResource.count({ where: { workspaceId: a.id } }),
      0,
    );
    assert.equal(await db.assistantWorkspace.count({ where: { id: b.id } }), 1);
    console.log(
      "Assistant growth: tenant isolation, version fencing, publish-once, cancellation, callback-once, quota reservation and cascade isolation passed",
    );
  } finally {
    globalThis.fetch = original;
    if (workspaceId)
      await db.assistantWorkspace.delete({ where: { id: workspaceId } });
    if (otherId) await db.assistantWorkspace.delete({ where: { id: otherId } });
    if (ownerId) await db.user.delete({ where: { id: ownerId } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
