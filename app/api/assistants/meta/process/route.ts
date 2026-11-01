import { NextRequest,NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { assistantConfig } from "@/lib/assistants/config";
import { secureEqual } from "@/lib/assistants/meta/security";
import { processMetaQueue } from "@/lib/assistants/meta/queue";
export const maxDuration=120;
export async function POST(request:NextRequest){const provided=request.headers.get("authorization")?.replace(/^Bearer /,"")||"",secrets=[assistantConfig().maintenanceSecret,getRuntimeConfig().stripe.reconcileSecret];if(!secrets.some(s=>s&&s.length>=32&&secureEqual(s,provided)))return NextResponse.json({error:"Unauthorized"},{status:401});try{return NextResponse.json(await processMetaQueue(2));}catch{return NextResponse.json({error:"Queue could not finish"},{status:500});}}
