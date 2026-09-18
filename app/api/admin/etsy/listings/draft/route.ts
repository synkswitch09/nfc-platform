import { NextRequest, NextResponse } from "next/server";
import { MarketplaceKind } from "@prisma/client";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { configureEtsyDraftListing, createEtsyDraftListing, EtsyError, type EtsyListingDefaults } from "@/lib/etsy";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ productId: z.string().uuid(), publish: z.boolean().default(false) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return jsonError("Administrator access required", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Select a product and publishing mode", 400);
  const [connection, product] = await Promise.all([
    db.marketplaceConnection.findFirst({ where: { storeId: context.store.id, kind: MarketplaceKind.ETSY, status: "ACTIVE" } }),
    db.product.findFirst({ where: { id: parsed.data.productId, storeId: context.store.id }, include: { variants: true, options: { include: { values: true } }, images: { orderBy: { sortOrder: "asc" } } } }),
  ]);
  if (!connection) return jsonError("Connect Etsy first", 409);
  if (!product) return jsonError("Product not found", 404);
  if (await db.marketplaceListing.findFirst({ where: { connectionId: connection.id, productId: product.id }, select: { id: true } })) return jsonError("This product is already linked to an Etsy listing", 409);
  const defaults = (connection.listingDefaults ?? {}) as EtsyListingDefaults;
  try {
    const created = await createEtsyDraftListing(connection, defaults, product);
    const listing = await db.marketplaceListing.create({ data: { connectionId: connection.id, productId: product.id, externalId: created.externalId, externalUrl: created.externalUrl, state: created.state } });
    try {
      const configured = await configureEtsyDraftListing(connection, listing.externalId, defaults, product, parsed.data.publish);
      await db.$transaction([
        db.marketplaceListing.update({ where: { id: listing.id }, data: { state: configured.state, lastError: null } }),
        db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: parsed.data.publish ? "ETSY_LISTING_PUBLISHED" : "ETSY_LISTING_DRAFT_CREATED", entityType: "MarketplaceListing", entityId: listing.id, metadata: { productId: product.id, externalId: listing.externalId } } }),
      ]);
      return NextResponse.json({ listing: { ...listing, state: configured.state } }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Etsy listing requires attention";
      await db.$transaction([
        db.marketplaceListing.update({ where: { id: listing.id }, data: { lastError: message } }),
        db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ETSY_LISTING_DRAFT_CREATED", entityType: "MarketplaceListing", entityId: listing.id, metadata: { productId: product.id, externalId: listing.externalId, configurationError: message } } }),
      ]);
      throw error;
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create Etsy listing", error instanceof EtsyError ? error.status : 502);
  }
}
