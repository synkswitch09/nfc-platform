import { CustomisationFieldType, PrismaClient, ProductType, Role } from "@prisma/client";
import { hashPassword } from "../lib/crypto";
import { passwordSchema } from "../lib/validation";

const db = new PrismaClient();
const categories = [
  { slug: "pet-tags", name: "Pet Tags", description: "Personalised NFC tags that help lost pets get home faster." },
  { slug: "child-safety", name: "Child Safety", description: "Privacy-conscious emergency contact products for families." },
  { slug: "social", name: "Social", description: "Share a social profile or link with one tap." },
  { slug: "business", name: "Business", description: "Reusable smart contact products for professionals and teams." },
  { slug: "luggage", name: "Luggage", description: "Minimal-contact smart tags for bags and travel gear." },
  { slug: "accessories", name: "Accessories", description: "Useful additions for TapKind products." },
];

type SeedOption = {
  code: string;
  name: string;
  type: CustomisationFieldType;
  required?: boolean;
  maxLength?: number;
  values?: string[];
};

const catalog: Array<{ slug: string; name: string; description: string; type: ProductType; sku: string; priceCents: number; category: string; featured?: boolean; options: SeedOption[] }> = [
  { slug: "pet-tag", name: "Personalised NFC Pet Tag", description: "A durable, 3D-printed tag with a fast emergency profile for a lost pet.", type: "PET", sku: "PET-BASE", priceCents: 2495, category: "pet-tags", featured: true, options: [
    { code: "pet-name", name: "Pet name", type: "SHORT_TEXT", required: true, maxLength: 24 },
    { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Ocean", "Coral"] },
    { code: "shape", name: "Shape", type: "SELECT", required: true, values: ["Round", "Bone", "Heart"] },
  ] },
  { slug: "child-safety-tag", name: "Child Safety NFC Tag", description: "A privacy-first guardian contact and critical-information tag.", type: "CHILD", sku: "CHILD-BASE", priceCents: 2795, category: "child-safety", featured: true, options: [
    { code: "printed-name", name: "Printed name", type: "SHORT_TEXT", required: true, maxLength: 24 },
    { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Ocean", "Coral"] },
  ] },
  { slug: "social-tag", name: "Social NFC Keyring", description: "Open one social destination or a flexible multi-link profile.", type: "SOCIAL", sku: "SOCIAL-BASE", priceCents: 1995, category: "social", options: [
    { code: "printed-text", name: "Printed text", type: "SHORT_TEXT", maxLength: 24 },
    { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Ocean", "Lime"] },
  ] },
  { slug: "business-tag", name: "Business NFC Product", description: "A polished digital contact product with a downloadable vCard-ready profile.", type: "BUSINESS", sku: "BIZ-BASE", priceCents: 2995, category: "business", options: [
    { code: "display-name", name: "Name or company", type: "SHORT_TEXT", required: true, maxLength: 36 },
    { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Navy"] },
  ] },
  { slug: "luggage-tag", name: "Smart NFC Luggage Tag", description: "Share only the contact details needed to return a lost bag.", type: "LUGGAGE", sku: "LUG-BASE", priceCents: 2295, category: "luggage", options: [
    { code: "printed-name", name: "Printed name", type: "SHORT_TEXT", required: true, maxLength: 28 },
    { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Ocean", "Coral"] },
  ] },
];

async function main() {
  const categoryIds = new Map<string, string>();
  for (const [sortOrder, item] of categories.entries()) {
    const category = await db.productCategory.upsert({
      where: { slug: item.slug },
      update: { name: item.name, description: item.description, sortOrder, active: true },
      create: { ...item, sortOrder },
    });
    categoryIds.set(item.slug, category.id);
  }

  for (const item of catalog) {
    const product = await db.product.upsert({
      where: { slug: item.slug },
      update: { name: item.name, description: item.description, shortDescription: item.description, type: item.type, categoryId: categoryIds.get(item.category), status: "ACTIVE", featured: item.featured ?? false },
      create: { slug: item.slug, name: item.name, description: item.description, shortDescription: item.description, type: item.type, categoryId: categoryIds.get(item.category), status: "ACTIVE", featured: item.featured ?? false },
    });
    await db.productVariant.upsert({
      where: { sku: item.sku },
      update: { productId: product.id, name: "Standard", priceCents: item.priceCents, active: true },
      create: { productId: product.id, sku: item.sku, name: "Standard", priceCents: item.priceCents, inventory: 100 },
    });
    for (const [sortOrder, optionSeed] of item.options.entries()) {
      const option = await db.productOption.upsert({
        where: { productId_code: { productId: product.id, code: optionSeed.code } },
        update: { name: optionSeed.name, type: optionSeed.type, required: optionSeed.required ?? false, maxLength: optionSeed.maxLength, sortOrder, active: true },
        create: { productId: product.id, code: optionSeed.code, name: optionSeed.name, type: optionSeed.type, required: optionSeed.required ?? false, maxLength: optionSeed.maxLength, sortOrder },
      });
      for (const [valueOrder, value] of (optionSeed.values ?? []).entries()) {
        await db.productOptionValue.upsert({
          where: { optionId_value: { optionId: option.id, value: value.toLowerCase() } },
          update: { label: value, sortOrder: valueOrder, active: true },
          create: { optionId: option.id, label: value, value: value.toLowerCase(), sortOrder: valueOrder },
        });
      }
    }
  }
  await db.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const email = process.env.DEV_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD;

  if (process.env.NODE_ENV === "production" && (email || password)) {
    throw new Error("Development administrator seeding is disabled in production");
  }
  if (Boolean(email) !== Boolean(password)) {
    throw new Error("Set both DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD, or leave both empty");
  }
  if (email && password) {
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) throw new Error(parsedPassword.error.issues[0]?.message ?? "Invalid development administrator password");
    const passwordHash = await hashPassword(parsedPassword.data);
    await db.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, passwordHash, emailVerifiedAt: new Date() },
      create: { email, name: "Platform Admin", role: Role.ADMIN, passwordHash, emailVerifiedAt: new Date() },
    });
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Database seed failed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
