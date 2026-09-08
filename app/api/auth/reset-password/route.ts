import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { passwordSchema } from "@/lib/validation";

const schema=z.object({token:z.string().min(32).max(200),password:passwordSchema});
export async function POST(request:NextRequest){if(!assertSameOrigin(request))return jsonError("Invalid request origin",403);const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return jsonError(parsed.error.issues[0]?.message??"Invalid request");const reset=await db.passwordReset.findUnique({where:{tokenHash:sha256(parsed.data.token)}});if(!reset||reset.usedAt||reset.expiresAt<=new Date())return jsonError("This reset link is invalid or expired",400);await db.$transaction([db.user.update({where:{id:reset.userId},data:{passwordHash:await hashPassword(parsed.data.password)}}),db.passwordReset.update({where:{id:reset.id},data:{usedAt:new Date()}}),db.session.deleteMany({where:{userId:reset.userId}}),db.auditLog.create({data:{actorId:reset.userId,action:"PASSWORD_RESET",entityType:"User",entityId:reset.userId}})]);return NextResponse.json({ok:true});}
