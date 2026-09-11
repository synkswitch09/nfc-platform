import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";

export async function notifyPaidOrder(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, storeDisplayName: true, totalCents: true, currency: true, guestEmail: true, user: { select: { email: true } }, store: { select: { supportEmail: true } } } });
  if (!order) return;
  const customerEmail = order.user?.email ?? order.guestEmail;
  const total = new Intl.NumberFormat("en-AU", { style: "currency", currency: order.currency }).format(order.totalCents / 100);
  const deliveries: Promise<unknown>[] = [];
  if (customerEmail) deliveries.push(sendTransactionalEmail({ to: customerEmail, subject: `${order.storeDisplayName} order ${order.orderNumber} confirmed`, text: `Thanks for your ${order.storeDisplayName} order. We received ${total} for ${order.orderNumber} and will let you know when production begins.` }));
  if (order.store.supportEmail && order.store.supportEmail !== customerEmail) deliveries.push(sendTransactionalEmail({ to: order.store.supportEmail, subject: `Paid order ${order.orderNumber}`, text: `${order.storeDisplayName} received a paid order for ${total}. Open Admin to review production and fulfilment.` }));
  await Promise.allSettled(deliveries);
}
