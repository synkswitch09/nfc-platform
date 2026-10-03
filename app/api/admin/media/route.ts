import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const [shared, products] = await Promise.all([
    db.categoryImage.findMany({
      where: { storeId: context.store.id, ...(query ? { OR: [{ altText: { contains: query, mode: "insensitive" } }, { purpose: { contains: query, mode: "insensitive" } }, { category: { name: { contains: query, mode: "insensitive" } } }, { page: { name: { contains: query, mode: "insensitive" } } }] } : {}) },
      select: { id: true, url: true, altText: true, purpose: true, createdAt: true, category: { select: { name: true } }, page: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    db.productImage.findMany({
      where: { product: { storeId: context.store.id }, ...(query ? { OR: [{ altText: { contains: query, mode: "insensitive" } }, { product: { name: { contains: query, mode: "insensitive" } } }] } : {}) },
      select: { id: true, url: true, altText: true, createdAt: true, product: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
  ]);
  const items = [
    ...shared.map(item => ({ id: item.id, url: item.url, label: item.altText || item.category?.name || item.page?.name || item.purpose, createdAt: item.createdAt })),
    ...products.map(item => ({ id: item.id, url: item.url, label: item.altText || item.product.name, createdAt: item.createdAt })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
  return NextResponse.json({ items: items.map(({ createdAt: _createdAt, ...item }) => item) });
}
