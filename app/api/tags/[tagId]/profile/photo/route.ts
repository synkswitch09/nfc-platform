import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { getCurrentStorefront } from "@/lib/storefront";
import { deleteStoredImage, MAX_PRODUCT_IMAGE_BYTES, validateAndStoreImage } from "@/lib/uploads";
import { isSafeStorageKey } from "@/lib/storage/keys";

const internalMediaPrefix = "/api/media/";

function storageKeyFromUrl(value?: string | null) {
  if (!value?.startsWith(internalMediaPrefix)) return null;
  const storageKey = value.slice(internalMediaPrefix.length);
  return isSafeStorageKey(storageKey) ? storageKey : null;
}

async function ownedPetTag(tagId: string) {
  const [user, store] = await Promise.all([getCurrentUser(), getCurrentStorefront()]);
  if (!user) return { error: jsonError("Unauthorised", 401) };
  const tag = await db.nFCTag.findFirst({ where: { id: tagId, storeId: store.id, ownerId: user.id, productType: "PET" }, include: { profile: { include: { pet: true } } } });
  const profile = tag?.profile; const pet = profile?.pet;
  if (!tag || !profile || !pet) return { error: jsonError("Pet tag not found", 404) };
  return { user, store, tag, profile, pet };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PRODUCT_IMAGE_BYTES + 100_000) return jsonError("Images must be 5 MB or smaller", 413);
  const { tagId } = await params; const context = await ownedPetTag(tagId); if ("error" in context) return context.error;
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return jsonError("Select a pet photo");
  let stored: Awaited<ReturnType<typeof validateAndStoreImage>>;
  try { stored = await validateAndStoreImage(file, context.store.slug, "pet-profile-photo"); }
  catch (error) { return jsonError(error instanceof Error && error.message === "IMAGE_SIZE" ? "Images must be 5 MB or smaller" : error instanceof Error && error.message === "IMAGE_DIMENSIONS" ? "Image dimensions are invalid or exceed 40 megapixels" : "Use a genuine PNG, JPEG or WebP image", 415); }
  const previousStorageKey = storageKeyFromUrl(context.pet.photoUrl);
  try {
    const photoUrl = `${internalMediaPrefix}${stored.storageKey}`;
    await db.$transaction(async tx => {
      await tx.petProfile.update({ where: { tagProfileId: context.profile.id }, data: { photoUrl } });
      await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "PET_PROFILE_PHOTO_UPDATED", entityType: "NFCTag", entityId: context.tag.id, metadata: { byteSize: stored.byteSize } } });
    });
    if (previousStorageKey && previousStorageKey !== stored.storageKey) await deleteStoredImage(previousStorageKey).catch(() => undefined);
    return NextResponse.json({ photoUrl });
  } catch { await deleteStoredImage(stored.storageKey).catch(() => undefined); return jsonError("Pet photo could not be saved", 500); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const { tagId } = await params; const context = await ownedPetTag(tagId); if ("error" in context) return context.error;
  const storageKey = storageKeyFromUrl(context.pet.photoUrl);
  await db.$transaction(async tx => {
    await tx.petProfile.update({ where: { tagProfileId: context.profile.id }, data: { photoUrl: null } });
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "PET_PROFILE_PHOTO_REMOVED", entityType: "NFCTag", entityId: context.tag.id } });
  });
  if (storageKey) await deleteStoredImage(storageKey).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
