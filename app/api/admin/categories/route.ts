import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminApiUser } from "@/lib/admin";
import { adminCategorySchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser();
  if (!user) return jsonError("Forbidden", 403);
  const parsed = adminCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid category");
  try {
    const category = await db.productCategory.create({ data: parsed.data });
    await db.auditLog.create({ data: { actorId: user.id, action: "CATEGORY_CREATED", entityType: "ProductCategory", entityId: category.id } });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("That category slug is already in use", 409);
    return jsonError("Category could not be created", 500);
  }
}
