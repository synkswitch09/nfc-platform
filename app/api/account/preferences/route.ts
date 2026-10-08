import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin,jsonError } from "@/lib/http";
import { getCurrentStorefront } from "@/lib/storefront";
export async function PATCH(request:NextRequest){if(!assertSameOrigin(request))return jsonError("Invalid origin",403);const user=await getCurrentUser();if(!user)return jsonError("Unauthorised",401);const input=z.object({marketing:z.boolean()}).strict().safeParse(await request.json().catch(()=>null));if(!input.success)return jsonError("Invalid preference");const store=await getCurrentStorefront();await db.storeMembership.upsert({where:{storeId_userId:{storeId:store.id,userId:user.id}},create:{storeId:store.id,userId:user.id,marketingConsentAt:input.data.marketing?new Date():null},update:{marketingConsentAt:input.data.marketing?new Date():null}});return NextResponse.json({ok:true});}
