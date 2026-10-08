import { NextRequest,NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin,jsonError } from "@/lib/http";
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!assertSameOrigin(request))return jsonError("Invalid origin",403);const context=await getAdminApiContext();if(!context?.isPlatformAdmin)return jsonError("Forbidden",403);const {id}=await params;const result=await db.teamInvitation.updateMany({where:{id,storeId:context.store.id,acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});if(!result.count)return jsonError("Invitation not found",404);await db.auditLog.create({data:{actorId:context.user.id,storeId:context.store.id,action:"TEAM_INVITATION_REVOKED",entityType:"TeamInvitation",entityId:id}});return NextResponse.json({ok:true});}
