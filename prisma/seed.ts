import { PrismaClient, ProductType, Role } from "@prisma/client";
import { hashPassword } from "../lib/crypto";
import { passwordSchema } from "../lib/validation";

const db = new PrismaClient();
const catalog: Array<{ slug: string; name: string; description: string; type: ProductType; sku: string; priceCents: number }> = [
  { slug:"pet-tag", name:"Pet Tag", description:"A durable tag with a fast emergency profile for a lost pet.", type:"PET", sku:"PET-BASE", priceCents:2495 },
  { slug:"child-safety-tag", name:"Child Safety Tag", description:"Privacy-first guardian contact and critical information.", type:"CHILD", sku:"CHILD-BASE", priceCents:2795 },
  { slug:"social-tag", name:"Social NFC Tag", description:"Open one social destination or a flexible multi-link profile.", type:"SOCIAL", sku:"SOCIAL-BASE", priceCents:1995 },
  { slug:"business-tag", name:"Business Tag", description:"A digital business card that stays current after every tap.", type:"BUSINESS", sku:"BIZ-BASE", priceCents:2995 },
  { slug:"luggage-tag", name:"Luggage Tag", description:"Share only the contact details needed to return a lost bag.", type:"LUGGAGE", sku:"LUG-BASE", priceCents:2295 },
];

async function main() {
  for (const item of catalog) {
    await db.product.upsert({ where:{slug:item.slug}, update:{name:item.name,description:item.description,type:item.type}, create:{slug:item.slug,name:item.name,description:item.description,type:item.type,variants:{create:{sku:item.sku,name:"Standard",priceCents:item.priceCents,inventory:100}}} });
  }
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
