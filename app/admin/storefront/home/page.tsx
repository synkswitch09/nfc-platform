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
    select: { id: true, sections: { select: { id: true }, take: 1 } },
  });
  // Older Stores (and an empty Home shell created by the older admin screen)
  // used Store.homepage directly. Adopt those live values so this editor never
  // opens with an empty list while the public Home still has visible content.
  if (!home || !home.sections.length) {
    const sections = defaultHomeSections(
      store.homepage,
      hasStoreCapability(store, StoreCapability.NFC),
    );
    try {
      home = await db.$transaction(async (tx) => {
        const sectionRows = sections.map((section, sortOrder) => ({
          storeId: store.id,
          type: section.type,
          name: section.name,
          visible: section.visible,
          sortOrder,
          content: section.content as Prisma.InputJsonValue,
        }));
        const created = home
          ? await tx.contentPage.update({
              where: { id: home.id },
              data: {
                status: "PUBLISHED",
                sections: { create: sectionRows },
              },
              select: { id: true, sections: { select: { id: true }, take: 1 } },
            })
          : await tx.contentPage.create({
              data: {
                storeId: store.id,
                kind: "HOME",
                slug: "home",
                name: "Home",
                status: "PUBLISHED",
                defaultLocale: store.defaultLocale,
                visualTheme: "CORAL",
                indexable: true,
                sections: { create: sectionRows },
              },
              select: { id: true, sections: { select: { id: true }, take: 1 } },
            });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            storeId: store.id,
            action: home ? "EMPTY_HOME_PAGE_POPULATED" : "HOME_PAGE_MIGRATED_TO_MODULAR",
            entityType: "ContentPage",
            entityId: created.id,
            metadata: { source: home ? "empty-home-page" : "legacy-homepage" },
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
        select: { id: true, sections: { select: { id: true }, take: 1 } },
      });
      if (!home) throw error;
    }
  }
  redirect(`/admin/pages/${home.id}?from=storefront`);
}
