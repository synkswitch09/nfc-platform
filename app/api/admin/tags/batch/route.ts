import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createActivationCode, createPublicTagId, hashActivationCode } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ productId: z.string().uuid(), productVariantId: z.string().uuid().optional().nullable(), quantity: z.number().int().min(1).max(100) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user || !["STAFF", "ADMIN"].includes(user.role)) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid batch request");
  const product = await db.product.findUnique({ where: { id: parsed.data.productId }, include: { variants: true } }); if (!product) return jsonError("Product not found", 404);
  if (parsed.data.productVariantId && !product.variants.some(v => v.id === parsed.data.productVariantId)) return jsonError("Variant does not belong to product");
  const origin = process.env.APP_URL ?? request.nextUrl.origin; const credentials = [];
  for (let index = 0; index < parsed.data.quantity; index++) {
    const activationCode = createActivationCode(); const publicTagId = createPublicTagId(); const publicUrl = `${origin}/t/${publicTagId}`;
    const tag = await db.nFCTag.create({ data: { publicTagId, activationCodeHash: await hashActivationCode(activationCode), productId: product.id, productVariantId: parsed.data.productVariantId, productType: product.type, status: "UNCLAIMED" } });
    credentials.push({ sequence: index + 1, tagId: tag.id, publicTagId, activationCode, publicUrl, qrDataUrl: await QRCode.toDataURL(publicUrl, { width: 220, margin: 1 }) });
  }
  await db.auditLog.create({ data: { actorId: user.id, action: "TAG_BATCH_CREATED", entityType: "NFCTag", metadata: { quantity: parsed.data.quantity, productId: product.id } } });
  return NextResponse.json({ warning: "Activation codes are shown once. Store the production sheet securely.", credentials });
}
