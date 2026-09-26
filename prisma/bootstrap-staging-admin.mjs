import { PrismaClient } from "@prisma/client";

if (process.env.APP_ENV !== "staging") throw new Error("Staging only");
const email = process.env.STAGING_BOOTSTRAP_EMAIL?.trim().toLowerCase();
if (!email || !email.includes("@")) throw new Error("A staging account email is required");
const db = new PrismaClient();

try {
  const domain = await db.storeDomain.findUnique({
    where: { environment_hostname: { environment: "STAGING", hostname: "staging.tapkin.com.au" } },
    include: { store: { select: { id: true, slug: true } } },
  });
  if (!domain || domain.store.slug !== "tapkin") throw new Error("Tapkin staging store not found");
  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true, status: true, emailVerifiedAt: true } });
  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) throw new Error("Verified, active staging account not found");
  const membership = await db.storeMembership.findUnique({
    where: { storeId_userId: { storeId: domain.store.id, userId: user.id } },
    select: { id: true },
  });
  if (!membership) throw new Error("Account is not registered in the Tapkin staging store");

  await db.$transaction(async (tx) => {
    const admins = await tx.storeMembership.count({ where: { storeId: domain.store.id, role: "ADMIN" } });
    if (admins) throw new Error("An administrator already exists; use Team access instead");
    await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await tx.storeMembership.update({ where: { id: membership.id }, data: { role: "ADMIN" } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({
      data: { actorId: user.id, storeId: domain.store.id, action: "STAGING_ADMIN_BOOTSTRAP", entityType: "User", entityId: user.id },
    });
  });
  console.log("Staging administrator created. Sign in again to refresh the session.");
} finally {
  await db.$disconnect();
}
