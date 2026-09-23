import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { importStorefrontRelease } from "@/lib/storefront-release";
import { readReleaseRequest, releaseErrorResponse } from "@/lib/storefront-release-request";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 40 * 1024 * 1024)
    return jsonError("Release files must be 40 MB or smaller.", 413);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context)) return jsonError("Store administrator access required", 403);
  try {
    const result = await importStorefrontRelease({ releaseInput: await readReleaseRequest(request), storeId: context.store.id, storeSlug: context.store.slug, actorId: context.user.id });
    revalidatePath("/", "layout");
    revalidatePath("/shop");
    revalidatePath("/admin", "layout");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const result = releaseErrorResponse(error);
    return jsonError(result.message, result.status);
  }
}
