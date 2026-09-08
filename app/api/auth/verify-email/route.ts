import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export async function GET(request:NextRequest){const token=request.nextUrl.searchParams.get("token");if(!token)return NextResponse.redirect(new URL("/login?verified=invalid",request.url));const record=await db.emailVerification.findUnique({where:{tokenHash:sha256(token)}});if(!record||record.usedAt||record.expiresAt<=new Date())return NextResponse.redirect(new URL("/login?verified=invalid",request.url));await db.$transaction([db.user.update({where:{id:record.userId},data:{emailVerifiedAt:new Date()}}),db.emailVerification.update({where:{id:record.id},data:{usedAt:new Date()}})]);return NextResponse.redirect(new URL("/dashboard?verified=true",request.url));}
