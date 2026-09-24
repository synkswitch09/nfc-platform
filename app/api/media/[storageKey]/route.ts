import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readStoredImage } from "@/lib/uploads";
import { getCurrentStorefront } from "@/lib/storefront";
import { isSafeStorageKey } from "@/lib/storage/keys";
import { getCurrentUser } from "@/lib/auth";
import { publicTagState } from "@/lib/catalog-policy";

export const dynamic = "force-dynamic";
const privateHeaders = { "cache-control": "private, no-store, max-age=0", "vary": "Cookie", "x-content-type-options": "nosniff" };
const notFound = () => new NextResponse("Not found", { status: 404, headers: privateHeaders });

function imageMimeType(storageKey: string) {
  if (storageKey.endsWith(".png")) return "image/png";
  if (storageKey.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(_: Request, { params }: { params: Promise<{ storageKey: string }> }) {
  const { storageKey } = await params;
  if (!isSafeStorageKey(storageKey)) return notFound();
  const store = await getCurrentStorefront();
  const [productImage, categoryImage, petPhoto] = await Promise.all([
    db.productImage.findFirst({ where: { storageKey, product: { storeId: store.id } }, select: { mimeType: true } }),
    db.categoryImage.findFirst({ where: { storageKey, storeId: store.id }, select: { mimeType: true } }),
    db.petProfile.findFirst({ where: { photoUrl: `/api/media/${storageKey}`, tagProfile: { tag: { storeId: store.id } } }, select: { tagProfile: { select: { isPublic: true, tag: { select: { status: true, ownerId: true } } } } } }),
  ]);
  const image = productImage ?? categoryImage;
  if (!image && !petPhoto) return notFound();
  if (petPhoto && publicTagState(petPhoto.tagProfile.tag.status, petPhoto.tagProfile.isPublic) !== "PROFILE") {
    const user = await getCurrentUser();
    if (!user || user.id !== petPhoto.tagProfile.tag.ownerId) return notFound();
  }
  const bytes = await readStoredImage(storageKey); if (!bytes) return notFound();
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": image?.mimeType ?? imageMimeType(storageKey), "content-length": String(bytes.byteLength), ...(petPhoto ? { ...privateHeaders, "x-robots-tag": "noindex, noimageindex" } : { "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" }) } });
}
