import { NextRequest, NextResponse } from "next/server";
import { addressDatabaseFields, addressSchema } from "@/lib/address-validation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user) return jsonError("Unauthorised", 401);
  const input=await request.json().catch(()=>null);
  if(input && typeof input === "object" && input.isDefault === true && Object.keys(input).length===1){const {addressId}=await params;const found=await db.address.findFirst({where:{id:addressId,userId:user.id},select:{id:true}});if(!found)return jsonError("Address not found",404);await db.$transaction(async tx=>{await tx.user.update({where:{id:user.id},data:{updatedAt:new Date()}});await tx.address.updateMany({where:{userId:user.id,isDefault:true},data:{isDefault:false}});await tx.address.update({where:{id:found.id},data:{isDefault:true}});});return NextResponse.json({ok:true});}
  const parsed = addressSchema.safeParse(input); if (!parsed.success) return NextResponse.json({ error: "Check the highlighted address fields and try again.", issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  const { addressId } = await params; const updated = await db.address.updateMany({ where: { id: addressId, userId: user.id }, data: addressDatabaseFields(parsed.data) });
  if (!updated.count) return jsonError("Address not found", 404); return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user) return jsonError("Unauthorised", 401);
  const { addressId } = await params; const removed = await db.address.deleteMany({ where: { id: addressId, userId: user.id } });
  if (!removed.count) return jsonError("Address not found", 404); return NextResponse.json({ ok: true });
}
