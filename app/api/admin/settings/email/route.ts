import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminApiContext, hasPermission } from "@/lib/admin";
import { db } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/config";
import { emailSendersSchema, senderDomain } from "@/lib/email-senders";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid origin", 403);
  const context = await getAdminApiContext();
  if (!context || !hasPermission(context, "settings.write")) return jsonError("Forbidden", 403);
  const parsed = emailSendersSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter valid sender emails and plain display names");
  const { email } = getRuntimeConfig();
  const fallbackAddress = context.store.slug === "kosykin" ? email.kosykinFromAddress ?? "hello@kosykin.com.au" : email.fromAddress ?? "hello@tapkin.com.au";
  const domain = senderDomain(fallbackAddress);
  if (Object.values(parsed.data).some(sender => sender.address && senderDomain(sender.address) !== domain)) return jsonError(`All senders must use @${domain}. Additional sending domains must be verified and configured before use.`);
  await db.$transaction(async tx => {
    const store = await tx.store.update({ where: { id: context.store.id }, data: { updatedAt: new Date() }, select: { accountConfig: true } });
    const previous = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
    await tx.store.update({ where: { id: context.store.id }, data: { accountConfig: { ...previous, emailSenders: parsed.data } } });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "EMAIL_SENDERS_UPDATED", entityType: "Store", entityId: context.store.id } });
  });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
