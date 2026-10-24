// Destructive fixtures are confined to the disposable CI database.
import { PrismaClient, Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awardOrderGifts } from "../lib/gift-campaigns";
import { experienceSchema } from "../lib/store-experience";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.CI !== "true" ||
    process.env.APP_ENV !== "development" ||
    url.hostname !== "localhost" ||
    url.pathname !== "/nfc_platform"
  )
    throw new Error("Only the disposable CI database is allowed");
  const db = new PrismaClient();
  let storeId = "";
  try {
    assert.equal(await db.store.count({ where: { slug: "kosykin" } }), 0);
    const store = await db.store.create({
      data: {
        slug: "kosykin",
        name: "Kosykin CI",
        displayName: "Kosykin CI",
        seoTitle: "CI",
        seoDescription: "CI only",
      },
    });
    storeId = store.id;
    const category = await db.productCategory.create({
      data: {
        storeId,
        slug: "stands-holders",
        name: "Stands & Holders",
        status: "PUBLISHED",
      },
    });
    const sql = readFileSync(
      "prisma/migrations/20261025010100_kosykin_experience_defaults/migration.sql",
      "utf8",
    );
    // Split static migration statements: Prisma executeRaw accepts one prepared statement.
    for (let attempt = 0; attempt < 2; attempt++)
      for (const statement of sql.split(/;\s*(?:\n|$)/).filter((s) => s.trim()))
        await db.$executeRawUnsafe(statement);
    const experience = experienceSchema.parse(
      (await db.storeExperience.findUniqueOrThrow({ where: { storeId } }))
        .config,
    );
    assert.equal(experience.groups.length, 1);
    assert.equal(experience.groups[0].home, true);
    assert.equal(experience.groups[0].shop, true);
    const campaign = await db.giftCampaign.findUniqueOrThrow({
      where: { storeId_key: { storeId, key: "launch-stands" } },
    });
    assert.equal(campaign.categoryId, category.id);
    assert.equal(campaign.limit, 50);
    assert.equal(campaign.active, true);
    const product = await db.product.create({
      data: {
        storeId,
        categoryId: category.id,
        slug: "ci-stand",
        name: "Stand",
        description: "CI",
        brand: "Kosykin",
        type: "ACCESSORY",
        status: "ACTIVE",
      },
    });
    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        sku: `ci-${storeId}`,
        name: "Blue",
        priceCents: 2995,
      },
    });
    const orders = await Promise.all(
      [0, 1].map((index) =>
        db.order.create({
          data: {
            orderNumber: `CI-${storeId}-${index}`,
            storeId,
            sourceDomain: "example.test",
            checkoutEnvironment: "PRODUCTION",
            storeDisplayName: "CI",
            guestEmail: "ci@example.test",
            status: "PAID",
            subtotalCents: 2995,
            totalCents: 2995,
            items: {
              create: {
                variantId: variant.id,
                quantity: 3,
                unitPriceCents: 2995,
                productName: "Stand",
                variantName: "Blue",
                sku: variant.sku,
                productType: "ACCESSORY",
              },
            },
          },
        }),
      ),
    );
    await db.giftCampaign.update({
      where: { id: campaign.id },
      data: { awardedCount: 49 },
    });
    async function settle(orderId: string) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await db.$transaction((tx) => awardOrderGifts(tx, orderId, storeId), {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
          return;
        } catch (error) {
          if (
            attempt === 4 ||
            !(
              (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2034") ||
              (error instanceof Error &&
                error.message.includes("retry payment settlement"))
            )
          )
            throw error;
        }
      }
    }
    await Promise.all(orders.map((order) => settle(order.id)));
    const exhausted = await db.giftCampaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });
    assert.equal(exhausted.awardedCount, 50);
    assert.equal(exhausted.active, false);
    assert.equal(
      await db.orderGift.count({ where: { campaignId: campaign.id } }),
      1,
      "Concurrent payments must award only the last slot, one gift regardless of quantity",
    );
    const award = await db.orderGift.findFirstOrThrow({
      where: { campaignId: campaign.id },
    });
    await settle(award.orderId);
    assert.equal(
      await db.orderGift.count({ where: { campaignId: campaign.id } }),
      1,
      "Replayed payment cannot duplicate a gift",
    );
    // A fresh cycle preserves the old snapshot and permits a new order.
    await db.giftCampaign.update({
      where: { id: campaign.id },
      data: { cycle: 2, awardedCount: 0, active: true },
    });
    const remainingOrder = orders.find((o) => o.id !== award.orderId)!;
    await settle(remainingOrder.id);
    assert.equal(
      await db.orderGift.count({ where: { campaignId: campaign.id } }),
      2,
    );
    console.log(
      "Shared content migration, paid-order gift concurrency and campaign cycles passed",
    );
  } finally {
    if (storeId) {
      await db.orderNotification.deleteMany({ where: { order: { storeId } } });
      await db.orderGift.deleteMany({ where: { order: { storeId } } });
      await db.orderItem.deleteMany({ where: { order: { storeId } } });
      await db.order.deleteMany({ where: { storeId } });
      await db.giftCampaign.deleteMany({ where: { storeId } });
      await db.productVariant.deleteMany({ where: { product: { storeId } } });
      await db.product.deleteMany({ where: { storeId } });
      await db.productCategory.deleteMany({ where: { storeId } });
      await db.store.delete({ where: { id: storeId } });
    }
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
