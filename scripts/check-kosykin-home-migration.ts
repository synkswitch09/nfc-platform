// CI-only data-migration regression: never run against a deployed store.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { kosykinHomeTemplate } from "../lib/kosykin-home-template";
import { validateLandingSections } from "../lib/landing-sections";
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.CI !== "true" || process.env.APP_ENV !== "development" || url.hostname !== "localhost" || url.pathname !== "/nfc_platform") throw new Error("Only the disposable CI database is allowed");
  const db = new PrismaClient();
  const rollback = new Error("Fixture rollback");
  try {
    try {
      await db.$transaction(async tx => {
        assert.equal(await tx.store.count({ where: { slug: "kosykin" } }), 0);
        const tapkin = await tx.store.findFirstOrThrow({ where: { slug: "tapkin" } });
        const store = await tx.store.create({ data: { slug: "kosykin", name: "Kosykin", displayName: "Kosykin", seoTitle: "Kosykin", seoDescription: "CI fixture" } });
        const initial = validateLandingSections(kosykinHomeTemplate().slice(0, 2));
        initial[0].content.copy = "Our edited introduction";
        initial[0].content.artworkUrl = "/images/kosykin/custom-hero.webp";
        const cards = initial[1].content.items as { imageUrl: string }[];
        cards[0].imageUrl = "/images/kosykin/custom-collection.webp";
        cards[1].imageUrl = "";
        const page = await tx.contentPage.create({ data: { storeId: store.id, slug: "home", name: "Home", kind: "HOME", status: "PUBLISHED" } });
        for (const [index, section] of initial.entries()) await tx.landingPageSection.create({ data: { storeId: store.id, pageId: page.id, type: section.type, name: section.name, visible: true, sortOrder: index, content: JSON.parse(JSON.stringify(section.content)) } });
        const heroBefore = await tx.landingPageSection.findFirstOrThrow({ where: { pageId: page.id, type: "HERO" } });
        const sql = readFileSync("prisma/migrations/20261023110000_kosykin_home_v3/migration.sql", "utf8");
        await tx.$executeRawUnsafe(sql);
        await tx.$executeRawUnsafe(sql);
        const sections = await tx.landingPageSection.findMany({ where: { pageId: page.id }, orderBy: { sortOrder: "asc" } });
        assert.equal(sections.length, 9, "Re-running the upgrade must not duplicate modules");
        validateLandingSections(sections.map(section => ({ ...section, content: section.content })));
        assert.equal(sections[0].id, heroBefore.id);
        assert.deepEqual(sections[0].content, heroBefore.content, "CMS hero edits must survive");
        const updatedCards = (sections[1].content as { items: { imageUrl: string }[] }).items;
        assert.equal(updatedCards[0].imageUrl, cards[0].imageUrl);
        assert.equal(updatedCards[1].imageUrl, "/images/kosykin/collection-planters.webp");
        assert.equal(sections[3].visible, false, "Do not advertise an unconfigured launch offer");
        assert.equal(sections[6].visible, false, "Do not publish placeholder testimonials");
        const launchSql = readFileSync("prisma/migrations/20261024100000_kosykin_shop_launch/migration.sql", "utf8");
        await tx.$executeRawUnsafe(launchSql);
        await tx.$executeRawUnsafe(launchSql);
        const launched = await tx.landingPageSection.findMany({ where: { pageId: page.id }, orderBy: { sortOrder: "asc" } });
        assert.equal(launched.length, 9);
        validateLandingSections(launched.map(section => ({ ...section, content: section.content })));
        assert.equal(launched[3].visible, true);
        assert.equal(launched[6].visible, true);
        assert.match((launched[6].content as { copy: string }).copy, /not real customer testimonials/);
        const realContent = { ...(launched[6].content as Record<string, unknown>), copy: "Customer feedback", items: [{ id: "real", title: "Retained author", description: "Retain the approved review" }] };
        await tx.landingPageSection.update({ where: { id: launched[6].id }, data: { content: realContent } });
        await tx.$executeRawUnsafe(launchSql);
        assert.deepEqual((await tx.landingPageSection.findUniqueOrThrow({ where: { id: launched[6].id } })).content, realContent);
        assert.deepEqual(await tx.store.findUniqueOrThrow({ where: { id: tapkin.id } }), tapkin, "Tapkin must remain untouched");
        throw rollback;
      }, { timeout: 30_000 });
    } catch (error) { if (error !== rollback) throw error; }
    console.log("Kosykin Home migration: nine modules, schemas, retained CMS content, media defaults, idempotency and store isolation passed");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
