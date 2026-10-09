import { requireAdminPageContext, hasPermission } from "@/lib/admin";
import { db } from "@/lib/db";
import { parseEmailTemplates } from "@/lib/email-templates";
import { EmailTemplatesEditor } from "@/components/email-templates-editor";

export default async function EmailTemplatesPage() {
  const context = await requireAdminPageContext();
  const store = await db.store.findUniqueOrThrow({ where: { id: context.store.id }, select: { accountConfig: true } });
  const config = store.accountConfig && typeof store.accountConfig === "object" && !Array.isArray(store.accountConfig) ? store.accountConfig as Record<string, unknown> : {};
  return <div><div className="admin-heading"><div><p className="admin-kicker">Content · {context.store.displayName}</p><h1>Email templates</h1><p>Design each notification with text, images and dynamic fields. Saved drafts do not affect emails until published.</p></div></div>
    <EmailTemplatesEditor initial={parseEmailTemplates(config.emailTemplates)} canEdit={hasPermission(context, "content.write")} canPublish={hasPermission(context, "content.publish")} testRecipient={context.user.email} />
  </div>;
}
