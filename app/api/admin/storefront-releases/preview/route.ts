import { NextRequest, NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { previewStorefrontRelease, storefrontReleaseSchema } from "@/lib/storefront-release";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 40 * 1024 * 1024)
    return jsonError("Release files must be 40 MB or smaller.", 413);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context)) return jsonError("Store administrator access required", 403);
  const payload = await request.json().catch(() => null);
  const parsed = storefrontReleaseSchema.safeParse(payload);
  if (!parsed.success) return jsonError("This is not a valid storefront release file.");
  return NextResponse.json({ preview: await previewStorefrontRelease(parsed.data, context.store.id) });
}
