import { EtsyManager } from "@/components/etsy-manager";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { isEtsyConfigured } from "@/lib/etsy";
import { getRuntimeConfig } from "@/lib/config";

export default async function EtsyPage({ searchParams }: { searchParams: Promise<{ etsy?: string }> }) {
  const context = await requireAdminPageContext();
  const [connection, products, jobs, params] = await Promise.all([
    db.marketplaceConnection.findFirst({
      where: { storeId: context.store.id, kind: "ETSY" },
      include: { listings: { include: { product: { select: { id: true, name: true, slug: true } } }, orderBy: { updatedAt: "desc" } } },
    }),
    db.product.findMany({ where: { storeId: context.store.id, status: { in: ["ACTIVE", "OUT_OF_STOCK"] } }, select: { id: true, name: true, slug: true, variants: { select: { sku: true, inventory: true, reservedInventory: true, active: true, trackInventory: true } } }, orderBy: { name: "asc" } }),
    db.marketplaceSyncJob.findMany({ where: { connection: { storeId: context.store.id, kind: "ETSY" } }, include: { listing: { include: { product: { select: { name: true } } } } }, orderBy: { updatedAt: "desc" }, take: 12 }),
    searchParams,
  ]);
  const canManage = context.isPlatformAdmin || context.storeRole === "ADMIN";
  return <EtsyManager canManage={canManage} configured={isEtsyConfigured()} callbackUrl={`${getRuntimeConfig().appUrl}/api/admin/etsy/callback`} result={params.etsy ?? null} connection={connection ? { status: connection.status, shopName: connection.shopName, shopId: connection.shopId, syncEnabled: connection.syncEnabled, lastError: connection.lastError, lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null, listings: connection.listings.map(listing => ({ id: listing.id, productId: listing.productId, productName: listing.product.name, externalId: listing.externalId, externalUrl: listing.externalUrl, state: listing.state, lastSyncedAt: listing.lastSyncedAt?.toISOString() ?? null, lastError: listing.lastError })) } : null} products={products.map(product => ({ ...product, variants: product.variants.map(variant => ({ ...variant, available: Math.max(0, variant.inventory - variant.reservedInventory) })) }))} jobs={jobs.map(job => ({ id: job.id, status: job.status, attempts: job.attempts, lastError: job.lastError, productName: job.listing?.product.name ?? "Unlinked listing", updatedAt: job.updatedAt.toISOString() }))} />;
}
