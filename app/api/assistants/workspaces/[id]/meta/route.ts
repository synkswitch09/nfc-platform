import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { assistantError,assistantWrite,ownedWorkspace,AssistantError } from "@/lib/assistants/http";
import { beginMetaConnection,chooseMetaAccount,disconnectMeta,saveMetaPreferences } from "@/lib/assistants/meta/connections";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 assistantWrite(request);const {id}=await params,{user}=await ownedWorkspace(id);if(!(await rateLimit("assistant-meta-settings",`${user.id}:${id}`,20,60000)).allowed)throw new AssistantError("Please wait a minute before trying again.",429);
 const body=z.discriminatedUnion("action",[
  z.object({action:z.literal("connect"),provider:z.enum(["FACEBOOK","INSTAGRAM"]),withComments:z.boolean()}),
  z.object({action:z.literal("choose"),flowId:z.uuid(),accountId:z.string().regex(/^\d{1,40}$/)}),
  z.object({action:z.literal("disconnect"),connectionId:z.uuid()}),
  z.object({action:z.literal("preferences"),connectionId:z.uuid(),autoMessages:z.boolean(),autoComments:z.boolean()})
 ]).parse(await request.json());
 if(body.action==="connect")return NextResponse.json({url:await beginMetaConnection(id,user.id,body.provider,body.withComments)});
 if(body.action==="choose"){await chooseMetaAccount(id,user.id,body.flowId,body.accountId);return NextResponse.json({saved:true});}
 if(body.action==="disconnect")await disconnectMeta(id,body.connectionId);else await saveMetaPreferences(id,body.connectionId,body.autoMessages,body.autoComments);return NextResponse.json({saved:true});
 }catch(error){return assistantError(error);}}
