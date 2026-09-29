import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { clearMediaJsonReference } from "@/lib/media-references";
import { deleteStoredImage } from "@/lib/uploads";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> },
) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context))
    return jsonError("Store administrator access required", 403);
  const { imageId } = await params;
  const image = await db.categoryImage.findFirst({
    where: { id: imageId, storeId: context.store.id },
    select: { id: true, storageKey: true, url: true },
  });
  if (!image) return jsonError("Media item not found", 404);

  const [store, sections, categories] = await Promise.all([
    db.store.findUnique({
      where: { id: context.store.id },
      select: {
        logoUrl: true,
        faviconUrl: true,
        socialImageUrl: true,
        headerConfig: true,
        footerConfig: true,
      },
    }),
    db.landingPageSection.findMany({
      where: { storeId: context.store.id },
      select: {
        id: true,
        content: true,
        translations: { select: { id: true, content: true } },
      },
    }),
    db.productCategory.findMany({
      where: { storeId: context.store.id },
      select: {
        id: true,
        benefits: true,
        useCases: true,
        howItWorks: true,
        contentSections: true,
      },
    }),
  ]);
  if (!store) return jsonError("Store not found", 404);
  const header = clearMediaJsonReference(store.headerConfig, image.url);
  const footer = clearMediaJsonReference(store.footerConfig, image.url);
  const sectionUpdates = sections.flatMap((section) => {
    const content = clearMediaJsonReference(section.content, image.url);
    const translations = section.translations.flatMap((translation) => {
      const translated = clearMediaJsonReference(translation.content, image.url);
      return translated.changed
        ? [{ id: translation.id, content: translated.value }]
        : [];
    });
    return content.changed || translations.length
      ? [{
          id: section.id,
          content: content.changed ? content.value : null,
          translations,
        }]
      : [];
  });
  const categoryUpdates = categories.flatMap((category) => {
    const values = {
      benefits: clearMediaJsonReference(category.benefits, image.url),
      useCases: clearMediaJsonReference(category.useCases, image.url),
      howItWorks: clearMediaJsonReference(category.howItWorks, image.url),
      contentSections: clearMediaJsonReference(category.contentSections, image.url),
    };
    return Object.values(values).some((value) => value.changed)
      ? [{ id: category.id, values }]
      : [];
  });

  await db.$transaction(async (tx) => {
    await tx.store.update({
      where: { id: context.store.id },
      data: {
        logoUrl: store.logoUrl === image.url ? null : undefined,
        faviconUrl: store.faviconUrl === image.url ? null : undefined,
        socialImageUrl: store.socialImageUrl === image.url ? null : undefined,
        headerConfig: header.changed
          ? (header.value as Prisma.InputJsonValue)
          : undefined,
        footerConfig: footer.changed
          ? (footer.value as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await Promise.all([
      tx.contentPage.updateMany({
        where: { storeId: context.store.id, ogImageUrl: image.url },
        data: { ogImageUrl: null },
      }),
      tx.product.updateMany({
        where: { storeId: context.store.id, ogImageUrl: image.url },
        data: { ogImageUrl: null },
      }),
      tx.productOptionValue.updateMany({
        where: {
          swatchImageUrl: image.url,
          option: { product: { storeId: context.store.id } },
        },
        data: { swatchImageUrl: null },
      }),
      ...([
        "imageUrl",
        "cardImageUrl",
        "heroImageUrl",
        "secondaryImageUrl",
        "ogImageUrl",
      ] as const).map((field) =>
        tx.productCategory.updateMany({
          where: { storeId: context.store.id, [field]: image.url },
          data: { [field]: null },
        }),
      ),
      ...sectionUpdates.flatMap((section) => [
        ...(section.content !== null
          ? [
              tx.landingPageSection.update({
                where: { id: section.id },
                data: { content: section.content as Prisma.InputJsonValue },
              }),
            ]
          : []),
        ...section.translations.map((translation) =>
          tx.landingPageSectionTranslation.update({
            where: { id: translation.id },
            data: { content: translation.content as Prisma.InputJsonValue },
          }),
        ),
      ]),
      ...categoryUpdates.map((category) =>
        tx.productCategory.update({
          where: { id: category.id },
          data: {
            benefits: category.values.benefits.value as Prisma.InputJsonValue,
            useCases: category.values.useCases.value as Prisma.InputJsonValue,
            howItWorks: category.values.howItWorks.value as Prisma.InputJsonValue,
            contentSections:
              category.values.contentSections.value as Prisma.InputJsonValue,
          },
        }),
      ),
    ]);
    await tx.categoryImage.delete({ where: { id: image.id } });
    await tx.auditLog.create({
      data: {
        actorId: context.user.id,
        storeId: context.store.id,
        action: "STORE_MEDIA_DELETED",
        entityType: "CategoryImage",
        entityId: image.id,
        metadata: {
          clearedSections: sectionUpdates.length,
          clearedCategoryContent: categoryUpdates.length,
        },
      },
    });
  });
  await deleteStoredImage(image.storageKey).catch(() => undefined);
  revalidatePath("/", "layout");
  revalidatePath("/admin/media");
  return NextResponse.json({ ok: true });
}
