import { db } from "@/lib/db";
export function isOptOut(text: string) {
  return /^(stop|unsubscribe|opt out|do not contact me|don't contact me|no me contacten|no me contactes|no me escriban|cancelar suscripci[oó]n|parar|basta|arr[eê]tez|abmelden)[.!\s]*$/i.test(
    text.trim(),
  );
}
export async function recordOptOut(
  workspaceId: string,
  conversationId: string,
) {
  if (process.env.AI_ASSISTANTS_GROWTH_ENABLED !== "true") return;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
    const contacts = await tx.assistantResource.findMany({
      where: {
        workspaceId,
        kind: "CONTACT",
        data: { path: ["conversationId"], equals: conversationId },
      },
      take: 500,
    });
    for (const contact of contacts)
      await tx.assistantResource.update({
        where: { id: contact.id },
        data: {
          version: { increment: 1 },
          data: { ...(contact.data as object), optedOut: true },
        },
      });
  });
}
