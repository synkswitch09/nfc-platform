import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import {
  resetStoreToPetsBaseline,
  storeResetSchema,
} from "@/lib/store-reset";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context))
    return jsonError("Store administrator access required", 403);
  const parsed = storeResetSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid reset request");
  try {
    const result = await resetStoreToPetsBaseline({
      storeId: context.store.id,
      actorId: context.user.id,
      input: parsed.data,
    });
    await Promise.all(
      result.storageKeys.map((storageKey) =>
        deleteStoredImage(storageKey).catch(() => undefined),
      ),
    );
    revalidatePath("/", "layout");
    revalidatePath("/shop");
    revalidatePath("/faq");
    revalidatePath("/pets");
    revalidatePath("/admin", "layout");
    return NextResponse.json({
      ok: true,
      category: { id: result.category.id, slug: result.category.slug },
      product: { id: result.product.id },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_RESET_DISABLED")
      return jsonError("Start fresh is disabled in production or when the environment is not explicitly configured", 403);
    if (error instanceof Error && error.message === "INVALID_CONFIRMATION")
      return jsonError("The store name does not match", 400);
    if (error instanceof Error && error.message === "STORE_NOT_FOUND")
      return jsonError("Store not found", 404);
    return jsonError("The store could not be reset", 500);
  }
}
