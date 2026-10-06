import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { packageFields } from "@/lib/shipping-admin-validation";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = packageFields.extend({ type: z.enum(["BOX", "MAILER"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid packaging", 400);
  const { type, ...fields } = parsed.data;
  if (type === "BOX" && fields.heightMm === 0) return jsonError("A box needs a height", 400);
  if (type === "MAILER" && fields.heightMm !== 0) return jsonError("A mailer uses the product thickness as its height", 400);
  if (fields.maxWeightGrams !== null && fields.maxWeightGrams <= fields.emptyWeightGrams) return jsonError("Maximum weight must exceed the empty package weight", 400);
  const code = `${type === "BOX" ? "UNIT-BOX" : "MAILER"}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const created = await db.packaging.create({ data: { ...fields, code, storeId: context!.store.id } });
  await db.auditLog.create({ data: { actorId: context!.user.id, storeId: context!.store.id, action: "PACKAGING_CREATED", entityType: "Packaging", entityId: created.id } });
  return NextResponse.json({ id: created.id, code }, { status: 201 });
}
