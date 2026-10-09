import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminApiContext, hasPermission } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendTransactionalEmail } from "@/lib/email";
import { orderEmailCategory } from "@/lib/email-senders";
import { emailTemplateKeys, getEmailTemplateEntry, parseEmailTemplates, validateEmailTemplate, defaultEmailTemplate, renderEmailTemplate, sampleEmailData } from "@/lib/email-templates";

const requestSchema = z.object({ key: z.enum(emailTemplateKeys), action: z.enum(["save", "publish", "reset", "preview", "test"]), template: z.unknown().optional(), revision: z.number().int().nonnegative().optional() }).strict();
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid origin", 403);
  const context = await getAdminApiContext("content.read");
  if (!context) return jsonError("Forbidden", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return jsonError("Template is too large", 413);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid template request");
  const { key, action, revision } = parsed.data;
  const permission = ["publish", "reset"].includes(action) ? "content.publish" : action === "preview" ? "content.read" : "content.write";
  if (!hasPermission(context, permission)) return jsonError("Forbidden", 403);
  const validation = validateEmailTemplate(key, action === "reset" ? defaultEmailTemplate(key) : parsed.data.template);
  if (!validation.success) return jsonError(validation.error);
  const template = validation.data;
  if (action === "preview" || action === "test") {
    const data = sampleEmailData(key, context.store.displayName, context.store.origin, context.store.logoUrl);
    if (action === "preview") return NextResponse.json(renderEmailTemplate(template, data));
    const limit = await rateLimit("email-template-test", `${context.store.id}:${context.user.id}`, 6, 60 * 60_000);
    if (!limit.allowed) return jsonError("You can send up to 6 test emails per hour.", 429);
    // Fixed to the signed-in editor: no arbitrary recipients, real credentials, orders or attachments.
    try {
      const accepted = await sendTransactionalEmail({ to: context.user.email, storeSlug: context.store.slug, subject: `[TEST] ${data.subject}`, text: `TEST EMAIL — example data only. Links and offers in this email are not valid.\n\n${data.message}`, customerName: data.customerName, templateKey: key, previewTemplate: template, templateFields: data.fields,
        category: ["verification", "password-reset", "security", "team-invitation"].includes(key) ? "account" : key === "support" ? "support" : key === "reward" ? "promotions" : key === "default" ? "default" : orderEmailCategory("paid:") });
      return NextResponse.json({ ok: true, accepted, message: accepted ? "Test accepted by the email provider. Staging tests are captured by the sandbox; production tests go to your account email." : "Test captured in mock mode; no email was delivered." });
    } catch { return jsonError("The email provider could not accept this test. Check the store sender and provider configuration.", 502); }
  }
  if (revision === undefined) return jsonError("Reload the editor before saving", 409);
  const result = await db.$transaction(async tx => {
    // Lock and reread so edits retain other settings and competing saves cannot overwrite each other.
    const store = await tx.store.update({ where: { id: context.store.id }, data: { updatedAt: new Date() }, select: { accountConfig: true } });
    const previous = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
    const templates = parseEmailTemplates(previous.emailTemplates);
    const current = getEmailTemplateEntry(templates, key);
    if (current.revision !== revision) return null;
    const timestamp = new Date().toISOString();
    const entry = { draft: template, published: action === "save" ? current.published : action === "reset" ? null : template, revision: current.revision + 1, updatedAt: timestamp, publishedAt: action === "save" ? current.publishedAt : action === "reset" ? null : timestamp };
    templates[key] = entry;
    await tx.store.update({ where: { id: context.store.id }, data: { accountConfig: { ...previous, emailTemplates: templates } } });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: `EMAIL_TEMPLATE_${action.toUpperCase()}`, entityType: "Store", entityId: context.store.id, metadata: { templateKey: key, revision: entry.revision } } });
    return entry;
  });
  if (!result) return jsonError("Another editor updated this template. Reload before saving your changes.", 409);
  revalidatePath("/admin/email-templates");
  return NextResponse.json({ ok: true, entry: result });
}
