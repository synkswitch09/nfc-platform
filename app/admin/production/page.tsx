import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageContext,hasPermission } from "@/lib/admin";
import { db } from "@/lib/db";
import { ProductionSettingsForm } from "@/components/production-settings-form";
import { ProductionBatchAction } from "@/components/production-batch-action";
import { projectQueue } from "@/lib/production-capacity";

export default async function ProductionPage() {
  const context=await requireAdminPageContext();const {store}=context;
  if (!hasPermission(context,"production.shared")) notFound();
  const environment = store.environment;
  const [pool, bookings] = await Promise.all([
    db.productionPool.findUnique({ where: { environment } }),
    db.productionBooking.findMany({ where: { environment, releasedAt: null }, include: { order: { select: { id: true, orderNumber: true, storeId: true, status: true, store: { select: { displayName: true } } } } }, orderBy: { promisedAt: "asc" }, take: 200 }),
  ]);
  const projected = projectQueue(bookings, pool?.weeklyCapacityMinutes ?? 360);
  const riskCount = projected.filter(item => item.atRisk).length;
  const used = bookings.reduce((sum, booking) => sum + booking.minutes, 0);
  const weekly = pool?.weeklyCapacityMinutes ?? 360;
  const days = pool?.maxBusinessDays ?? 10;
  return <div><div className="admin-heading"><div><p className="admin-kicker">Shared production · {environment}</p><h1>X2D capacity</h1><p>One queue for Tapkin and Kosykin. Shipping releases a booking; paid orders remain visible in their own store.</p></div></div>
    <section className="admin-panel"><h2>Capacity and pause</h2><p>{used} of {Math.floor(weekly * days / 5)} minutes booked in the acceptance window.</p><ProductionSettingsForm weekly={weekly} days={days} paused={pool?.paused ?? false} /></section>
    {riskCount > 0 && !pool?.reviewedAt && <ProductionBatchAction count={riskCount} version={pool?.version ?? 0} />}
    <section className="admin-panel"><h2>Shared queue</h2><div className="compact-list">{projected.map(booking => <div key={booking.orderId}><span><strong>{booking.order.orderNumber} · {booking.order.store.displayName}</strong><small>{booking.minutes} minutes · {booking.order.status}</small></span><span>Promised {booking.promisedAt.toLocaleDateString("en-AU")}{booking.atRisk && <small>Recalculated {booking.recalculated.toLocaleDateString("en-AU")}</small>}{booking.order.storeId === store.id && <Link href={`/admin/orders/${booking.orderId}`}>Open order</Link>}</span></div>)}</div>{!bookings.length && <p className="muted">No outstanding production bookings.</p>}</section>
  </div>;
}
