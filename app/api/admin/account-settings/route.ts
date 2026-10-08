import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminApiContext, hasPermission } from "@/lib/admin";
import { accountConfigSchema } from "@/lib/account-config";
import { db } from "@/lib/db";
import { assertSameOrigin,jsonError } from "@/lib/http";
export async function PATCH(request:NextRequest){if(!assertSameOrigin(request))return jsonError("Invalid origin",403);const context=await getAdminApiContext();if(!hasPermission(context,"settings.write")||!context)return jsonError("Forbidden",403);const parsed=accountConfigSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return jsonError("Invalid account settings");await db.$transaction([db.store.update({where:{id:context.store.id},data:{accountConfig:parsed.data}}),db.auditLog.create({data:{actorId:context.user.id,storeId:context.store.id,action:"ACCOUNT_SETTINGS_UPDATED",entityType:"Store",entityId:context.store.id}})]);revalidatePath("/","layout");return NextResponse.json({ok:true});}
