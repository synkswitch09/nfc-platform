import { SupportPortal } from "@/components/support-portal";
import { requireUser } from "@/lib/auth";
import { getCurrentStorefront } from "@/lib/storefront";
import { parseAccountConfig } from "@/lib/account-config";
import { parseSupportConfig } from "@/lib/support-config";
import { db } from "@/lib/db";
export default async function HelpPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [user, store, query] = await Promise.all([requireUser(), getCurrentStorefront(), searchParams]);
  const config = parseAccountConfig(store.accountConfig), support = parseSupportConfig(store.accountConfig);
  const order = query.order ? await db.order.findFirst({ where: { id: query.order, storeId: store.id, userId: user.id }, select: { orderNumber: true } }) : null;
  return <section className="dashboard"><h1>Help & requests</h1><SupportPortal verified account guestEnabled={support.guestEnabled} topics={config.requestTopics} helpText={config.helpText} responseDays={support.firstResponseBusinessDays} selectedOrder={order?.orderNumber} /></section>;
}
