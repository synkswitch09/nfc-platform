import { db } from "@/lib/db";
import { maintainPublications } from "../content/publishing";
export async function maintainGrowth(now = new Date()) {
  await db.assistantResource.updateMany({
    where: {
      kind: "PUBLISH_JOB",
      status: "IN_FLIGHT",
      updatedAt: { lt: new Date(now.getTime() - 5 * 60000) },
    },
    data: { status: "UNCERTAIN" },
  });
  const expired = await db.assistantResource.findMany({
    where: {
      kind: "CALL",
      data: { path: ["transcriptExpiresAt"], lt: now.toISOString() },
    },
    select: { id: true, data: true },
    take: 100,
  });
  for (const record of expired) {
    const {
      transcript: _transcript,
      transcriptExpiresAt: _expiry,
      audioConsentEvidence: _consent,
      ...metadata
    } = record.data as Record<string, unknown>;
    await db.assistantResource.update({
      where: { id: record.id },
      data: { data: { ...metadata, transcriptExpired: true } },
    });
  }
  return {
    transcriptsPurged: expired.length,
    publicationsAdvanced: await maintainPublications(),
  };
}
