import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminApiContext } from "@/lib/admin";
import { currentAppEnvironment } from "@/lib/config";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { createStoreSchema, newStoreData } from "@/lib/store-creation";
import { deploymentEnvironment } from "@/lib/storefront";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context?.isPlatformAdmin) return jsonError("Platform administrator access required", 403);

  const parsed = createStoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid store", 400);

  try {
    const store = await db.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: newStoreData(parsed.data, deploymentEnvironment(currentAppEnvironment())),
      });
      await tx.auditLog.create({
        data: { actorId: context.user.id, storeId: created.id, action: "STORE_CREATED", entityType: "Store", entityId: created.id,
          metadata: { hostname: parsed.data.hostname, environment: currentAppEnvironment() } },
      });
      return created;
    });
    revalidatePath("/admin/stores");
    return NextResponse.json({ store: { id: store.id, slug: store.slug } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return jsonError("A store with this slug or domain already exists", 409);
    throw error;
  }
}
