import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { importStorefrontRelease, storefrontReleaseSchema } from "@/lib/storefront-release";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 40 * 1024 * 1024)
    return jsonError("Release files must be 40 MB or smaller.", 413);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context)) return jsonError("Store administrator access required", 403);
  const payload = await request.json().catch(() => null);
  const parsed = storefrontReleaseSchema.safeParse(payload);
  if (!parsed.success) return jsonError("This is not a valid storefront release file.");
  try {
    const result = await importStorefrontRelease({ releaseInput: parsed.data, storeId: context.store.id, storeSlug: context.store.slug, actorId: context.user.id });
    revalidatePath("/", "layout");
    revalidatePath("/shop");
    revalidatePath("/admin", "layout");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error && error.message === "RELEASE_SKU_BELONGS_TO_ANOTHER_STORE"
      ? "A SKU in this release already belongs to another store. SKUs must be unique across stores."
      : error instanceof Error && error.message.includes("RELEASE_MEDIA")
        ? "Release media could not be verified or copied."
        : "The storefront release could not be imported.";
    return jsonError(message, 409);
  }
}
