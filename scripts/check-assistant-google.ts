import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { findOrCreateOAuthUser, oauthConfigWithCredentials } from "../lib/oauth";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (process.env.CI !== "true" || process.env.APP_ENV !== "development" || url.hostname !== "localhost" || url.pathname !== "/nfc_platform") throw new Error("Only the disposable CI database is allowed");
  const prefix = `google-ci-${randomUUID()}`, ids: string[] = [];
  const config = oauthConfigWithCredentials("google", { clientId: "ci-google-id", clientSecret: "ci-not-real-secret" })!;
  try {
    const admin = await db.user.create({ data: { email: `${prefix}@example.test`, name: "Google admin", role: "ADMIN", emailVerifiedAt: new Date() } }); ids.push(admin.id);
    const claims = { sub: `${prefix}-sub`, email: admin.email, email_verified: true };
    const linked = await findOrCreateOAuthUser(config, claims, undefined, { allowCreate: false });
    assert.equal(linked.id, admin.id); assert.equal(linked.role, "ADMIN");
    assert.equal(await db.storeMembership.count({ where: { userId: admin.id } }), 0);
    const [a, b] = await Promise.all([findOrCreateOAuthUser(config, claims), findOrCreateOAuthUser(config, claims)]);
    assert.equal(a.id, admin.id); assert.equal(b.id, admin.id);
    assert.equal(await db.oAuthAccount.count({ where: { userId: admin.id } }), 1);
    const freshClaims = { sub: `${prefix}-fresh-sub`, email: `${prefix}-fresh@example.test`, email_verified: true };
    await assert.rejects(findOrCreateOAuthUser(config, freshClaims, undefined, { allowCreate: false }), /REGISTRATION_CLOSED/);
    const fresh = await findOrCreateOAuthUser(config, freshClaims); ids.push(fresh.id);
    assert.equal(fresh.role, "CUSTOMER"); assert.ok(fresh.emailVerifiedAt);
    assert.equal(await db.storeMembership.count({ where: { userId: fresh.id } }), 0);
    await db.user.update({ where: { id: admin.id }, data: { status: "SUSPENDED" } });
    await assert.rejects(findOrCreateOAuthUser(config, claims), /ACCOUNT_DISABLED/);
    console.log("Assistant Google: existing admin identity, duplicate linking, registration closure and store isolation passed.");
  } finally {
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
