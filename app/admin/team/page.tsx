import { Search } from "lucide-react";
import { TeamRoleForm } from "@/components/team-role-form";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["ADMIN"]); const { q = "" } = await searchParams;
  const users = await db.user.findMany({ where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : { role: { in: ["STAFF", "ADMIN"] } }, orderBy: [{ role: "desc" }, { name: "asc" }], take: 100 });
  return <div><div className="admin-heading"><div><p className="admin-kicker">System</p><h1>Team access</h1><p>Promote an existing verified customer to staff or administrator.</p></div></div><form className="admin-filters"><label><Search size={17} /><input name="q" defaultValue={q} placeholder="Search a verified user by name or email" /></label><button className="button secondary">Search</button></form><section className="admin-panel flush"><div className="admin-table team-table"><div className="admin-tr admin-th"><span>User</span><span>Verified</span><span>Account</span><span>Current role</span><span>Change access</span></div>{users.map(user => <div className="admin-tr" key={user.id}><span><strong>{user.name}</strong><small>{user.email}</small></span><span>{user.emailVerifiedAt ? user.emailVerifiedAt.toLocaleDateString("en-AU") : "No"}</span><span className={`admin-status ${user.status}`}>{user.status}</span><strong>{user.role}</strong><TeamRoleForm userId={user.id} role={user.role} /></div>)}</div>{!users.length && <div className="admin-empty">No users match this search.</div>}</section><p className="muted">Role changes revoke all of that user’s sessions. They must sign in again before the new permissions take effect.</p></div>;
}
