import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readStoredImage } from "@/lib/uploads";
import { getCurrentStorefront } from "@/lib/storefront";

export async function GET(_: Request, { params }: { params: Promise<{ storageKey: string }> }) {
  const { storageKey } = await params;
  const store = await getCurrentStorefront();
  const image = await db.productImage.findFirst({ where: { storageKey, product: { storeId: store.id } }, select: { mimeType: true } });
  if (!image) return new NextResponse("Not found", { status: 404 });
  const bytes = await readStoredImage(storageKey); if (!bytes) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": image.mimeType, "content-length": String(bytes.byteLength), "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
