import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin,jsonError } from "@/lib/http";
import { getCurrentStorefront } from "@/lib/storefront";
const schema=z.object({name:z.string().trim().min(2).max(80),phone:z.string().trim().max(40).nullable().optional()}).strict();
export async function PATCH(request:NextRequest){if(!assertSameOrigin(request))return jsonError("Invalid origin",403);const user=await getCurrentUser();if(!user)return jsonError("Unauthorised",401);const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return jsonError("Check your name and phone. The account email cannot be changed.");const store=await getCurrentStorefront();await db.$transaction([db.user.update({where:{id:user.id},data:{name:parsed.data.name,phone:parsed.data.phone||null}}),db.auditLog.create({data:{actorId:user.id,storeId:store.id,action:"ACCOUNT_PROFILE_UPDATED",entityType:"User",entityId:user.id}})]);return NextResponse.json({ok:true});}
