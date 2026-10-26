import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";
import { parseAccountConfig } from "@/lib/account-config";
import { assertSameOrigin, jsonError } from "@/lib/http";
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid origin", 403);
  const store = await getCurrentStorefront();
  if (!parseAccountConfig(store.accountConfig).favouritesEnabled || store.status !== "ACTIVE") return jsonError("Unavailable", 404);
  const parsed = z.object({ slugs: z.array(z.string().min(1).max(100)).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid favourites");
  const products = await db.product.findMany({
    where: { storeId: store.id, status: "ACTIVE", shopVisible: true, slug: { in: parsed.data.slugs } },
    select: { id: true, description: true, createdAt: true, slug: true, name: true, shortDescription: true, personalisationMode: true, options: { where: { active: true }, include: { values: { where: { active: true } } } }, images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { id: true, url: true, altText: true, optionValueId: true, variantId: true } }, variants: { where: { active: true }, orderBy: { priceCents: "asc" }, select: { id: true, imageId: true, colour: true, priceCents: true, optionSelection: true } } },
  });
  return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
}
