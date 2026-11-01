import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createOpaqueToken,sha256 } from "@/lib/crypto";
import { getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { assistantConfig } from "@/lib/assistants/config";
import { assistantAccess } from "@/lib/assistants/policy";
import { assistantReply } from "@/lib/assistants/replies";
import { AssistantError,assistantError } from "@/lib/assistants/http";
async function context(request:NextRequest){const key=request.nextUrl.searchParams.get("key"),origin=request.headers.get("origin");if(!key||!z.uuid().safeParse(key).success||!origin)throw new AssistantError("Chat unavailable",403);const workspace=await db.assistantWorkspace.findUnique({where:{widgetKey:key}});if(!assistantConfig().launchEnabled||!workspace||!workspace.allowedOrigins.includes(origin)||!workspace.channels.includes("WEB"))throw new AssistantError("Chat unavailable",403);return {workspace,origin};}
function cors(response:NextResponse,origin:string){response.headers.set("Access-Control-Allow-Origin",origin);response.headers.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");response.headers.set("Access-Control-Allow-Headers","Content-Type, Authorization");response.headers.set("Cache-Control","no-store");response.headers.set("Vary","Origin");return response;}
export async function OPTIONS(request:NextRequest){try{const {origin}=await context(request);return cors(new NextResponse(null,{status:204}),origin);}catch(error){return assistantError(error);}}
export async function GET(request:NextRequest){try{const {workspace,origin}=await context(request),token=request.headers.get("authorization")?.replace(/^Bearer /,"");if(!token||token.length>200)throw new AssistantError("Conversation not found",404);const conversation=await db.assistantConversation.findUnique({where:{tokenHash:sha256(token)},include:{messages:{orderBy:{createdAt:"desc"},take:30}}});if(!conversation||conversation.workspaceId!==workspace.id)throw new AssistantError("Conversation not found",404);return cors(NextResponse.json({messages:conversation.messages.reverse().map(m=>({role:m.role,text:m.text})),humanOnly:conversation.humanOnly}),origin);}catch(error){return assistantError(error);}}
const input=z.object({token:z.string().min(30).max(200).optional(),message:z.string().trim().min(1).max(3000),requestId:z.uuid(),human:z.boolean().optional()}).strict();
export async function POST(request:NextRequest){let origin:string|undefined;try{
 const ctx=await context(request);origin=ctx.origin;const workspace=ctx.workspace;if(!(await rateLimit("assistant-public-chat",`${workspace.id}:${getClientIp(request)}`,15,60000)).allowed)throw new AssistantError("Please wait a minute before sending another message.",429);
 const access=assistantAccess(workspace);if(!access.active||(access.reason==="trial"&&workspace.trialChannel!=="WEB")||!workspace.knowledgeApprovedAt)throw new AssistantError("This assistant is currently unavailable. Please contact the business directly.",403);
 const data=input.parse(await request.json());let token=data.token;let conversation=token?await db.assistantConversation.findUnique({where:{tokenHash:sha256(token)}}):null;if(token&&(!conversation||conversation.workspaceId!==workspace.id))throw new AssistantError("Conversation not found",404);if(!conversation){token=createOpaqueToken();conversation=await db.assistantConversation.create({data:{workspaceId:workspace.id,tokenHash:sha256(token),channel:"WEB"}});}
 const conversationId=conversation.id,lockUntil=new Date(Date.now()+45000);if(!(await db.assistantConversation.updateMany({where:{id:conversationId,OR:[{lockedUntil:null},{lockedUntil:{lt:new Date()}}]},data:{lockedUntil:lockUntil}})).count)throw new AssistantError("Your previous message is still being answered. Please wait a moment.",409);
 try{
  const prior=await db.assistantMessage.findUnique({where:{conversationId_requestId:{conversationId,requestId:data.requestId}}});if(prior){const reply=await db.assistantMessage.findUnique({where:{conversationId_requestId:{conversationId,requestId:`reply:${data.requestId}`}}});return cors(NextResponse.json({token,reply:reply?.text||"Your message has been received.",humanOnly:conversation.humanOnly}),origin);}
  const incoming=await db.assistantMessage.create({data:{conversationId,requestId:data.requestId,role:"USER",text:data.message,status:"PENDING"}});
  if(data.human||conversation.humanOnly){await db.assistantConversation.update({where:{id:conversationId},data:{humanOnly:true}});await db.assistantMessage.update({where:{id:incoming.id},data:{status:"COMPLETE"}});return cors(NextResponse.json({token,reply:"Your message is available for the team to review. Please contact the business directly if you need urgent help.",humanOnly:true}),origin);}
  const history=await db.assistantMessage.findMany({where:{conversationId,OR:[{status:"COMPLETE"},{id:incoming.id}]},orderBy:{createdAt:"desc"},take:10});
  try{
   const reply=await assistantReply(workspace,history.reverse().map(m=>({role:m.role==="ASSISTANT"?"assistant" as const:"user" as const,content:m.text})));
   // Recheck handoff under a row lock: a human takeover during generation
   // suppresses the generated answer instead of sending both responses.
   const delivered=await db.$transaction(async tx=>{const rows=await tx.$queryRaw<{humanOnly:boolean}[]>`SELECT "humanOnly" FROM "AssistantConversation" WHERE "id" = ${conversationId}::uuid FOR UPDATE`;if(!rows.length||rows[0].humanOnly){await tx.assistantMessage.update({where:{id:incoming.id},data:{status:"COMPLETE"}});return false;}await tx.assistantMessage.create({data:{conversationId,requestId:`reply:${data.requestId}`,role:"ASSISTANT",text:reply}});await tx.assistantMessage.update({where:{id:incoming.id},data:{status:"COMPLETE"}});await tx.assistantConversation.update({where:{id:conversationId},data:{updatedAt:new Date()}});return true;});
   return cors(NextResponse.json({token,reply:delivered?reply:"The team has taken over this conversation.",humanOnly:!delivered}),origin);
  }catch(error){await db.assistantMessage.update({where:{id:incoming.id},data:{status:"FAILED"}});const response=assistantError(error instanceof AssistantError?error:new AssistantError("We could not answer just now. Please try again shortly.",502));return cors(NextResponse.json({...await response.json(),token},{status:response.status}),origin);}
 }finally{await db.assistantConversation.updateMany({where:{id:conversationId,lockedUntil:lockUntil},data:{lockedUntil:null}});}
 }catch(error){const response=assistantError(error);return origin?cors(response,origin):response;}}
