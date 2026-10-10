import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { LoyaltyAdjustmentForm } from "@/components/loyalty-settings-form";
import { sha256 } from "@/lib/crypto";
import type { Prisma } from "@prisma/client";
export default async function LoyaltyAdmin({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const context = await getAdminApiContext("settings.write"); if (!context) notFound();
  const params = await searchParams; const q = (params.q ?? "").trim().slice(0, 100); const page = Math.max(1, Math.min(1000, Math.floor(Number(params.page) || 1)));
  const where: Prisma.LoyaltyWalletWhereInput = { storeId: context.store.id, ...(q ? { OR: [{ emailHash: sha256(q.toLowerCase()) }, { user: { name: { contains: q, mode: "insensitive" } } }, { user: { email: { equals: q, mode: "insensitive" } } }, { lots: { some: { order: { orderNumber: { contains: q, mode: "insensitive" } } } } }] } : {}) };
  const found = await db.loyaltyWallet.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * 50, take: 51, include: { user: { select: { name: true } }, lots: { where: { expiresAt: { gt: new Date() }, remainingPoints: { gt: 0 } }, select: { remainingPoints: true } }, reservations: { where: { status: "HELD" }, select: { points: true } } } });
  const wallets = found.slice(0, 50);
  const entries = await db.loyaltyEntry.findMany({ where: { wallet: { storeId: context.store.id } }, orderBy: { createdAt: "desc" }, take: 50, include: { wallet: { include: { user: { select: { name: true } } } }, order: { select: { orderNumber: true } } } });
  const name = (w: { id: string; user: { name: string } | null }) => `${w.user?.name ?? "Guest / unclaimed"} · ${w.id.slice(-8)}`;
  return <section className="admin-panel"><Link href="/admin/settings">← Store settings</Link><h1>Points accounts & adjustments</h1><p>{context.store.displayName} · Up to 50 accounts per page and 50 recent activity entries. Guest balances are claimed only after verified email ownership; account hashes are not exposed.</p>
    <form method="get"><label className="field">Find points account<input name="q" defaultValue={q} maxLength={100} placeholder="Customer name, exact email or order number" /></label><button className="button secondary">Search</button></form>
    <div className="table-wrap"><table><thead><tr><th>Account</th><th>Available</th><th>Reserved</th><th>Refund adjustment</th></tr></thead><tbody>{wallets.map(w => <tr key={w.id}><td>{name(w)}</td><td>{Math.max(0, w.lots.reduce((n, l) => n + l.remainingPoints, 0) - w.debtPoints)}</td><td>{w.reservations.reduce((n, r) => n + r.points, 0)}</td><td>{w.debtPoints}</td></tr>)}</tbody></table></div>{!wallets.length && <p>No points accounts yet. They appear when a qualifying purchase is paid or a verified customer opens Points.</p>}
    <LoyaltyAdjustmentForm wallets={wallets.map(w => ({ id: w.id, label: name(w) }))} />
    <nav aria-label="Points account pages">{page > 1 && <Link href={`?page=${page - 1}&q=${encodeURIComponent(q)}`}>Previous page</Link>} <span>Page {page}</span> {found.length > 50 && <Link href={`?page=${page + 1}&q=${encodeURIComponent(q)}`}>Next page</Link>}</nav>
    <h2>Recent activity</h2><div className="table-wrap"><table><thead><tr><th>Time</th><th>Account</th><th>Activity</th><th>Points</th><th>Details</th></tr></thead><tbody>{entries.map(e => <tr key={e.id}><td>{e.createdAt.toLocaleString("en-AU", { timeZone: context.store.timezone })}</td><td>{name(e.wallet)}</td><td>{e.kind}</td><td>{e.points}</td><td>{e.order?.orderNumber} {e.description}</td></tr>)}</tbody></table></div></section>;
}
