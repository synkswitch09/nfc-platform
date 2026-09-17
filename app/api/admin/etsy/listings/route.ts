import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { queueEtsyInventorySync, verifyEtsyListing } from "@/lib/etsy";

const linkSchema = z.object({ productId: z.string().uuid(), externalId: z.string().trim().regex(/^\d{3,20}$/) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return jsonError("Administrator access required", 403);
  const parsed = linkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a valid Etsy listing ID");
  const [connection, product] = await Promise.all([
    db.marketplaceConnection.findFirst({ where: { storeId: context.store.id, kind: "ETSY", status: "ACTIVE" } }),
    db.product.findFirst({
      where: { id: parsed.data.productId, storeId: context.store.id },
      include: { variants: { select: { sku: true, priceCents: true, inventory: true, reservedInventory: true, active: true, trackInventory: true, backorderPolicy: true } } },
    }),
  ]);
  if (!connection) return jsonError("Connect Etsy before linking a product", 409);
  if (!product) return jsonError("Product not found", 404);
  try {
    const verified = await verifyEtsyListing(connection, parsed.data.externalId, product.variants);
    const listing = await db.$transaction(async tx => {
      const saved = await tx.marketplaceListing.upsert({ where: { connectionId_productId: { connectionId: connection.id, productId: product.id } }, create: { connectionId: connection.id, productId: product.id, externalId: parsed.data.externalId, externalUrl: verified.externalUrl, state: verified.state }, update: { externalId: parsed.data.externalId, externalUrl: verified.externalUrl, state: verified.state, lastError: null } });
      await queueEtsyInventorySync(tx, context.store.id, product.id);
      await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ETSY_LISTING_LINKED", entityType: "MarketplaceListing", entityId: saved.id, metadata: { productId: product.id, externalId: parsed.data.externalId } } });
      return saved;
    });
    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) { return jsonError(error instanceof Error ? error.message : "Could not verify Etsy listing", error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 502); }
}

export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return jsonError("Administrator access required", 403);
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId || !z.string().uuid().safeParse(productId).success) return jsonError("Invalid product", 400);
  const listing = await db.marketplaceListing.findFirst({ where: { productId, connection: { storeId: context.store.id, kind: "ETSY" } } });
  if (!listing) return jsonError("Etsy link not found", 404);
  await db.$transaction([db.marketplaceSyncJob.deleteMany({ where: { listingId: listing.id } }), db.marketplaceListing.delete({ where: { id: listing.id } }), db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ETSY_LISTING_UNLINKED", entityType: "MarketplaceListing", entityId: listing.id, metadata: { productId } } })]);
  return NextResponse.json({ ok: true });
}
