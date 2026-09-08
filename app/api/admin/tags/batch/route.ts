import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { getAdminApiUser } from "@/lib/admin";
import { createActivationCode, createPublicTagId, hashActivationCode } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ productId: z.string().uuid(), productVariantId: z.string().uuid().optional().nullable(), quantity: z.number().int().min(1).max(100), notes: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid batch request");
  const product = await db.product.findUnique({ where: { id: parsed.data.productId }, include: { variants: { where: { active: true } } } });
  if (!product) return jsonError("Product not found", 404);
  const variant = parsed.data.productVariantId ? product.variants.find(item => item.id === parsed.data.productVariantId) : null;
  if (parsed.data.productVariantId && !variant) return jsonError("Variant does not belong to product");
  const secrets = await Promise.all(Array.from({ length: parsed.data.quantity }, async (_, index) => {
    const activationCode = createActivationCode();
    return { sequence: index + 1, activationCode, activationCodeHash: await hashActivationCode(activationCode), publicTagId: createPublicTagId() };
  }));
  const batchNumber = `B-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const batch = await db.$transaction(async tx => {
    const created = await tx.manufacturingBatch.create({ data: { batchNumber, productId: product.id, productVariantId: variant?.id, quantity: secrets.length, createdById: user.id, notes: parsed.data.notes || null } });
    await tx.nFCTag.createMany({ data: secrets.map(secret => ({ publicTagId: secret.publicTagId, activationCodeHash: secret.activationCodeHash, productId: product.id, productVariantId: variant?.id, productType: product.type, status: "MANUFACTURED", manufacturingStatus: "GENERATED", manufacturingBatchId: created.id, batchSequence: secret.sequence })) });
    await tx.auditLog.create({ data: { actorId: user.id, action: "MANUFACTURING_BATCH_CREATED", entityType: "ManufacturingBatch", entityId: created.id, metadata: { batchNumber, quantity: secrets.length, productId: product.id } } });
    return created;
  });
  const origin = process.env.APP_URL ?? request.nextUrl.origin;
  const credentials = await Promise.all(secrets.map(async secret => {
    const publicUrl = `${origin}/t/${secret.publicTagId}`;
    return { sequence: secret.sequence, publicTagId: secret.publicTagId, activationCode: secret.activationCode, publicUrl, qrDataUrl: await QRCode.toDataURL(publicUrl, { width: 220, margin: 1, errorCorrectionLevel: "M" }) };
  }));
  return NextResponse.json({ batch: { id: batch.id, batchNumber: batch.batchNumber }, warning: "Activation codes are shown once. Export or print this production sheet now.", credentials }, { status: 201 });
}
