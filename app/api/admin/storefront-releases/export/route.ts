import { NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { createStorefrontRelease } from "@/lib/storefront-release";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context))
    return NextResponse.json({ error: "Store administrator access required" }, { status: 403 });
  try {
    const release = await createStorefrontRelease(context.store.id);
    return new NextResponse(JSON.stringify(release, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${context.store.slug}-storefront-release.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("RELEASE_MEDIA_")
      ? "A referenced image is missing or the release media is larger than 25 MB. Restore or remove the image, then try again."
      : "The storefront release could not be created.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
