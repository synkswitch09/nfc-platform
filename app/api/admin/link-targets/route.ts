import { NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function GET() {
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  const [pages, categories, products] = await Promise.all([
    db.contentPage.findMany({
      where: { storeId: context.store.id, status: "PUBLISHED", categoryId: null, kind: { not: "HOME" } },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    db.productCategory.findMany({
      where: { storeId: context.store.id, status: "PUBLISHED" },
      select: { name: true, slug: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.product.findMany({
      where: { storeId: context.store.id, status: "ACTIVE", shopVisible: true },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({
    targets: [
      { href: "/", label: "Home" },
      { href: "/shop", label: "Shop" },
      { href: "/faq", label: "FAQs" },
      ...pages.map((page) => ({ href: `/${page.slug}`, label: `Page — ${page.name}` })),
      ...categories.map((category) => ({ href: `/${category.slug}`, label: `Category — ${category.name}` })),
      ...products.map((product) => ({ href: `/products/${product.slug}`, label: `Product — ${product.name}` })),
    ],
  });
}
