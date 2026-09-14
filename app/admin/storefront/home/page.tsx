import { redirect } from "next/navigation";
import { Prisma, StoreCapability } from "@prisma/client";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { defaultHomeSections } from "@/lib/default-home-sections";
import { hasStoreCapability } from "@/lib/storefront";

export default async function AdminStorefrontHomePage() {
  const { store, user } = await requireAdminPageContext();
  let home = await db.contentPage.findFirst({
    where: { storeId: store.id, kind: "HOME", categoryId: null },
    select: { id: true },
  });
  // Older Stores used Store.homepage directly. The first visit to Home adopts
  // those live values into modular sections, so the editor never starts blank.
  if (!home) {
    const sections = defaultHomeSections(
      store.homepage,
      hasStoreCapability(store, StoreCapability.NFC),
    );
    try {
      home = await db.$transaction(async (tx) => {
        const created = await tx.contentPage.create({
          data: {
            storeId: store.id,
            kind: "HOME",
            slug: "home",
            name: "Home",
            status: "PUBLISHED",
            defaultLocale: store.defaultLocale,
            visualTheme: "CORAL",
            indexable: true,
            sections: {
              create: sections.map((section, sortOrder) => ({
                storeId: store.id,
                type: section.type,
                name: section.name,
                visible: section.visible,
                sortOrder,
                content: section.content as Prisma.InputJsonValue,
              })),
            },
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            storeId: store.id,
            action: "HOME_PAGE_MIGRATED_TO_MODULAR",
            entityType: "ContentPage",
            entityId: created.id,
            metadata: { source: "legacy-homepage" },
          },
        });
        return created;
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      home = await db.contentPage.findFirst({
        where: { storeId: store.id, kind: "HOME", categoryId: null },
        select: { id: true },
      });
      if (!home) throw error;
    }
  }
  redirect(`/admin/pages/${home.id}?from=storefront`);
}
