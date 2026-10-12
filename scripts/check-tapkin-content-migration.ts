// CI-only: test publication, rollback safety and store isolation in a disposable DB.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { validateLandingSections } from "../lib/landing-sections";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.CI !== "true" || process.env.APP_ENV !== "development" || url.hostname !== "localhost" || url.pathname !== "/nfc_platform") throw new Error("Only the disposable CI database is allowed");
  const db = new PrismaClient();
  const sql = readFileSync("prisma/migrations/20261016000000_tapkin_terms_privacy/migration.sql", "utf8");
  const rollback = new Error("Roll back disposable policy fixtures");
  try {
    await db.$transaction(async tx => {
      const original = await tx.store.findUniqueOrThrow({ where: { slug: "tapkin" } });
      await tx.store.update({ where: { id: original.id }, data: { slug: `ci-original-${original.id}` } });
      const store = await tx.store.create({ data: { slug: "tapkin", name: "Tapkin fixture", displayName: "Tapkin", seoTitle: "Tapkin", seoDescription: "Test fixture" } });
      const other = await tx.store.create({ data: { slug: "kosykin", name: "Kosykin fixture", displayName: "Kosykin", seoTitle: "Kosykin", seoDescription: "Test fixture" } });
      const otherPage = await tx.contentPage.create({ data: { storeId: other.id, slug: "terms", name: "Existing Kosykin terms", kind: "LEGAL", sections: { create: { storeId: other.id, name: "Keep Kosykin", type: "RICH_TEXT", content: { headline: "Keep", copy: "Existing Kosykin CMS edits" } } } }, include: { sections: true } });
      const previous = await tx.contentPage.create({ data: { storeId: store.id, slug: "terms", name: "Old Tapkin terms", kind: "LEGAL", sections: { create: { storeId: store.id, name: "Previous CMS policy", type: "RICH_TEXT", content: { headline: "Previous", copy: "Retain this for review" } } } }, include: { sections: true } });
      await tx.$executeRawUnsafe(sql);
      const pages = await tx.contentPage.findMany({ where: { storeId: store.id }, include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: { slug: "asc" } });
      assert.equal(pages.length, 2);
      for (const page of pages) {
        assert.equal(page.kind, "LEGAL"); assert.equal(page.status, "PUBLISHED"); assert.equal(page.indexable, true); assert.equal(page.showInFooter, true);
        const visible = page.sections.filter(s => s.visible);
        validateLandingSections(visible);
        assert.equal(visible.length, page.slug === "terms" ? 19 : 18);
      }
      const old = await tx.landingPageSection.findUniqueOrThrow({ where: { id: previous.sections[0].id } });
      assert.equal(old.visible, false); assert.equal((old.content as { copy: string }).copy, "Retain this for review");
      assert.deepEqual(await tx.contentPage.findUniqueOrThrow({ where: { id: otherPage.id }, include: { sections: true } }), otherPage, "Kosykin page and sections must be untouched");
      assert.deepEqual(await tx.store.findUniqueOrThrow({ where: { id: store.id } }), store, "No operational or brand settings may change");
      const privacy = pages.find(p => p.slug === "privacy")!;
      const edited = privacy.sections.find(s => s.visible)!;
      await tx.landingPageSection.update({ where: { id: edited.id }, data: { visible: false, content: { headline: "Later CMS edit", copy: "Authoritative editor change" } } });
      await tx.contentPage.update({ where: { id: privacy.id }, data: { name: "Edited privacy title", status: "DRAFT", indexable: false } });
      const before = await tx.contentPage.findMany({ where: { storeId: store.id }, include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: { slug: "asc" } });
      await tx.$executeRawUnsafe(sql);
      assert.deepEqual(await tx.contentPage.findMany({ where: { storeId: store.id }, include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: { slug: "asc" } }), before, "Repeated release must preserve CMS edits and not duplicate sections");
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) {
    if (error !== rollback) throw error;
    console.log("Tapkin policies: publication, CMS validation, prior-content retention, repeat safety and Kosykin isolation passed");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
