import { NextRequest, NextResponse } from "next/server";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin",403);
  const limited = await rateLimit("forgot-password",getClientIp(request),5,60*60*1000); if(!limited.allowed) return jsonError("Too many attempts",429);
  const parsed = z.object({email:z.string().trim().toLowerCase().email()}).safeParse(await request.json().catch(()=>null));
  if (parsed.success) { const user = await db.user.findUnique({where:{email:parsed.data.email}}); if(user){ const token=createOpaqueToken(); await db.passwordReset.create({data:{userId:user.id,tokenHash:sha256(token),expiresAt:new Date(Date.now()+60*60*1000)}}); const origin=process.env.APP_URL??request.nextUrl.origin; await sendTransactionalEmail({to:user.email,subject:"Reset your TapKind password",text:`Reset your password: ${origin}/reset-password?token=${token}`}).catch(()=>undefined); } }
  return NextResponse.json({message:"If that account exists, reset instructions have been sent."});
}
