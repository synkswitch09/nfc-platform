import { NextResponse } from "next/server";
import { getCurrentStorefront } from "@/lib/storefront";
import { buildMetaCatalog } from "@/lib/meta-catalog";
export async function GET() {
  const result = await buildMetaCatalog(await getCurrentStorefront());
  if (!result) return new NextResponse(null, { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
  // A complete feed enables Meta to remove products omitted after unpublishing/deletion.
  return new NextResponse(result.csv, { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=60", "content-disposition": "inline; filename=meta-catalog.csv", "x-robots-tag": "noindex, nofollow" } });
}
