import { timingSafeEqual } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { assistantConfig } from "@/lib/assistants/config";
import { maintainAssistants } from "@/lib/assistants/maintenance";
export async function POST(request:NextRequest){const config=assistantConfig(),provided=request.headers.get("authorization")?.replace(/^Bearer /,"")||"",secrets=[config.maintenanceSecret,getRuntimeConfig().stripe.reconcileSecret].filter((s):s is string=>Boolean(s&&s.length>=32));if(!secrets.some(s=>Buffer.byteLength(provided)===Buffer.byteLength(s)&&timingSafeEqual(Buffer.from(s),Buffer.from(provided))))return NextResponse.json({error:"Unauthorized"},{status:401});if(!config.launchEnabled)return NextResponse.json({skipped:"assistant-service-disabled"});try{return NextResponse.json(await maintainAssistants());}catch{return NextResponse.json({error:"Maintenance could not finish"},{status:500});}}
