// CI-only database verification. Never run against a deployed store.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseFooterConfig, footerSocialProfiles } from "../lib/site-chrome";
import { validateLandingSections, modularFaq } from "../lib/landing-sections";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.CI !== "true" || process.env.APP_ENV !== "development" || url.hostname !== "localhost" || url.pathname !== "/nfc_platform") throw new Error("Only the disposable CI database is allowed");
  const db = new PrismaClient();
  try {
    assert.equal(await db.store.count({ where: { slug: "kosykin" } }), 0, "This must be a new test fixture");
    const tapkin = await db.store.findFirstOrThrow({ where: { slug: "tapkin" } });
    const store = await db.store.create({ data: { slug: "kosykin", name: "Kosykin", displayName: "Kosykin", seoTitle: "Kosykin", seoDescription: "Test fixture" } });
    const previous = await db.contentPage.create({ data: { storeId: store.id, slug: "terms", kind: "LEGAL", name: "Terms", sections: { create: { storeId: store.id, type: "RICH_TEXT", name: "Previous policy", content: { headline: "Previous policy", copy: "A previous CMS policy retained for review." } } } }, include: { sections: true } });
    const faq = await db.contentPage.create({ data: { storeId: store.id, slug: "faq", kind: "CAMPAIGN", name: "FAQs", sections: { create: { storeId: store.id, type: "FAQ", name: "Existing FAQ", content: { headline: "Existing FAQ", items: [{ question: "What is 3D printing?", answer: "Previously edited answer retained in the CMS.", visible: true, order: 0 }] } } } } });
    await db.$executeRawUnsafe(readFileSync("prisma/migrations/20261014000000_kosykin_policies_faq/migration.sql", "utf8"));
    const pages = await db.contentPage.findMany({ where: { storeId: store.id }, include: { sections: true } });
    assert.equal(pages.length, 7);
    for (const page of pages) {
      assert.equal(page.status, "PUBLISHED"); assert.equal(page.indexable, true); assert.equal(page.showInFooter, true);
      validateLandingSections(page.sections.map(section => ({ ...section, content: section.content })));
    }
    assert.equal((await db.landingPageSection.findUniqueOrThrow({ where: { id: previous.sections[0].id } })).visible, false);
    const items = modularFaq(pages.find(page => page.id === faq.id)!.sections);
    assert.equal(items.filter(item => item.question === "What is 3D printing?").length, 1);
    assert.equal(items.find(item => item.question === "What is 3D printing?")!.answer, "Previously edited answer retained in the CMS.");
    assert.ok(items.length >= 80);
    assert.deepEqual(await db.store.findUniqueOrThrow({ where: { id: tapkin.id } }), tapkin, "Tapkin must remain untouched");
    const icon = "/images/tapkin/brand/footer-logo.webp";
    await db.store.update({ where: { id: store.id }, data: { footerConfig: { logoUrl: icon, socialIcons: { instagram: icon, facebook: icon } }, socialLinks: { instagram: "https://instagram.com/test" } } });
    const beforeSections = await db.landingPageSection.findMany({ where: { storeId: store.id } });
    await db.$executeRawUnsafe(readFileSync("prisma/migrations/20261015000000_clean_footer_registered_brands/migration.sql", "utf8"));
    const updatedStore = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    const footer = parseFooterConfig(updatedStore.footerConfig);
    assert.equal(footer.includeManagedPages, false); assert.equal(footer.policyLinks.length, 5); assert.equal(footer.customLinks.length, 2);
    assert.equal(footer.logoUrl, icon); assert.equal(footer.socialIcons.instagram, icon);
    assert.equal(footerSocialProfiles(footer, updatedStore.socialLinks as Record<string, string>)[0].href, "https://instagram.com/test");
    assert.equal((updatedStore.organization as Record<string, unknown>).registeredBusinessName, "Kosykin");
    assert.equal(updatedStore.legalName, "FORERO GUTIERREZ, YULIANY ROCIO");
    const afterSections = await db.landingPageSection.findMany({ where: { storeId: store.id } });
    assert.equal(afterSections.length, beforeSections.length);
    assert.equal((await db.landingPageSection.findUniqueOrThrow({ where: { id: previous.sections[0].id } })).visible, false);
    assert.equal(modularFaq(afterSections).find(item => item.question === "What is 3D printing?")!.answer, "Previously edited answer retained in the CMS.");
    const tapkinAfter = await db.store.findUniqueOrThrow({ where: { id: tapkin.id } });
    assert.deepEqual(tapkinAfter.headerConfig, tapkin.headerConfig); assert.deepEqual(tapkinAfter.socialLinks, tapkin.socialLinks);
    console.log("Footer migration: policy navigation, registered brand identity, media, legacy socials and edited FAQ preservation passed");
    await db.contentPage.deleteMany({ where: { storeId: store.id } }); await db.store.delete({ where: { id: store.id } });
    console.log("Kosykin migration: published content, CMS schemas, retained edits, duplicate prevention and store isolation passed");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
