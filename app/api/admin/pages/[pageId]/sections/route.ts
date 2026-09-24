import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { validateLandingSections } from "@/lib/landing-sections";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  let sections; try { sections = validateLandingSections((await request.json()).sections); } catch (error) { return jsonError(sectionValidationMessage(error)); }
  const { pageId } = await params; const page = await db.contentPage.findFirst({ where: { id: pageId, storeId: context.store.id, categoryId: null }, select: { id: true, slug: true, kind: true } }); if (!page) return jsonError("Page not found", 404);
  try {
    const savedSections = await db.$transaction(async tx => {
    const existing = await tx.landingPageSection.findMany({ where: { pageId, storeId: context.store.id }, select: { id: true } });
    const existingIds = new Set(existing.map(section => section.id));
    const unknownId = sections.find(section => section.id && !existingIds.has(section.id));
    if (unknownId) throw new Error("A section no longer belongs to this page. Refresh and try again.");
    const retainedIds = sections.flatMap(section => section.id ? [section.id] : []);
    await tx.landingPageSection.deleteMany({ where: { pageId, storeId: context.store.id, ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}) } });
    for (const [sortOrder, section] of sections.entries()) {
      const data = { type: section.type, name: section.name, visible: section.visible, sortOrder, content: section.content as Prisma.InputJsonValue };
      if (section.id) await tx.landingPageSection.update({ where: { id: section.id }, data });
      else await tx.landingPageSection.create({ data: { ...data, storeId: context.store.id, pageId } });
    }
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CONTENT_PAGE_SECTIONS_UPDATED", entityType: "ContentPage", entityId: pageId, metadata: { sectionCount: sections.length } } });
    return tx.landingPageSection.findMany({ where: { pageId, storeId: context.store.id }, orderBy: { sortOrder: "asc" }, select: { id: true, type: true, name: true, visible: true, content: true } });
    });
    revalidatePath(page.kind === "HOME" ? "/" : `/${page.slug}`);
    revalidatePath(`/admin/pages/${pageId}`);
    return NextResponse.json({ ok: true, sections: savedSections });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Landing sections could not be saved", 409);
  }
}

function sectionValidationMessage(error: unknown) {
  const message = error instanceof Error ? error.message.replaceAll("\n", " ").slice(0, 260) : "Invalid section data";
  return `Landing sections could not be saved: ${message}`;
}

const faqUpdate = z.object({
  sectionId: z.string().uuid().optional().nullable(),
  revision: z.string().max(100_000).nullable(),
  items: z.array(z.object({
    id: z.string().uuid(), question: z.string().trim().min(3).max(200),
    answer: z.string().trim().min(5).max(1_500), visible: z.boolean(),
    order: z.number().int().min(0).max(1_000),
  })).max(30),
});

// Saving the dedicated FAQ editor must not replace unrelated sections or
// silently overwrite edits made in another admin session.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = faqUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid FAQ content", 400);
  const { pageId } = await params;
  try {
    const section = await db.$transaction(async (tx) => {
      const page = await tx.contentPage.findFirst({ where: { id: pageId, storeId: context.store.id, categoryId: null, slug: "faq" }, select: { id: true } });
      if (!page) throw new Error("FAQ page not found");
      const current = await tx.landingPageSection.findMany({ where: { pageId, storeId: context.store.id, type: "FAQ" }, orderBy: { sortOrder: "asc" } });
      if (current.length > 1 || (current[0]?.id ?? null) !== (parsed.data.sectionId ?? null) ||
          (current[0] ? JSON.stringify(current[0].content) : null) !== parsed.data.revision)
        throw new Error("FAQs changed since you opened this page. Reload and review before saving.");
      const content = { ...(current[0]?.content && typeof current[0].content === "object" && !Array.isArray(current[0].content) ? current[0].content : {}), items: parsed.data.items };
      const saved = current[0]
        ? await tx.landingPageSection.update({ where: { id: current[0].id }, data: { content: content as Prisma.InputJsonValue } })
        : await tx.landingPageSection.create({ data: { storeId: context.store.id, pageId, name: "General FAQs", type: "FAQ", visible: true, sortOrder: 0, content: content as Prisma.InputJsonValue } });
      await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CONTENT_PAGE_FAQS_UPDATED", entityType: "ContentPage", entityId: pageId, metadata: { count: parsed.data.items.length } } });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/faq");
    revalidatePath(`/admin/pages/${pageId}`);
    return NextResponse.json({ ok: true, section: { id: section.id, content: section.content } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "FAQs could not be saved", 409);
  }
}
