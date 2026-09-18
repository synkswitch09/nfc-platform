import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readStoredImage } from "@/lib/uploads";
import { getCurrentStorefront } from "@/lib/storefront";
import { isSafeStorageKey } from "@/lib/storage/keys";

function imageMimeType(storageKey: string) {
  if (storageKey.endsWith(".png")) return "image/png";
  if (storageKey.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(_: Request, { params }: { params: Promise<{ storageKey: string }> }) {
  const { storageKey } = await params;
  if (!isSafeStorageKey(storageKey)) return new NextResponse("Not found", { status: 404 });
  const store = await getCurrentStorefront();
  const [productImage, categoryImage, petPhoto] = await Promise.all([
    db.productImage.findFirst({ where: { storageKey, product: { storeId: store.id } }, select: { mimeType: true } }),
    db.categoryImage.findFirst({ where: { storageKey, storeId: store.id }, select: { mimeType: true } }),
    db.petProfile.findFirst({ where: { photoUrl: `/api/media/${storageKey}`, tagProfile: { tag: { storeId: store.id } } }, select: { id: true } }),
  ]);
  const image = productImage ?? categoryImage;
  if (!image && !petPhoto) return new NextResponse("Not found", { status: 404 });
  const bytes = await readStoredImage(storageKey); if (!bytes) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": image?.mimeType ?? imageMimeType(storageKey), "content-length": String(bytes.byteLength), "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
