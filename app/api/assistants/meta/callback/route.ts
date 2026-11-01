import { NextRequest,NextResponse } from "next/server";
import { assistantActor,ownedWorkspace } from "@/lib/assistants/http";
import { assistantUrl,isAssistantHost } from "@/lib/assistants/config";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { finishMetaAuthorization } from "@/lib/assistants/meta/connections";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 if(!isAssistantHost(request.headers.get("host")))return new NextResponse(null,{status:404});
 const destination=new URL(assistantUrl("/account"));
 try{const user=await assistantActor(),state=request.nextUrl.searchParams.get("state")||"",code=request.nextUrl.searchParams.get("code")||"";if(state.length<32||state.length>200||!code||code.length>4096)throw Error("Invalid callback");const pending=await db.assistantMetaFlow.findUnique({where:{stateHash:sha256(state)}});if(!pending)throw Error("Expired callback");await ownedWorkspace(pending.workspaceId);const flow=await finishMetaAuthorization(state,code,user.id);destination.searchParams.set("business",flow.workspaceId);destination.searchParams.set("meta","choose");}catch{destination.searchParams.set("meta","retry");}
 return NextResponse.redirect(destination,{status:303,headers:{"cache-control":"no-store","referrer-policy":"no-referrer"}});
}
