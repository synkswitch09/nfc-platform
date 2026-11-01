import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createOpaqueToken,sha256 } from "@/lib/crypto";
import { ASSISTANT_COOKIE } from "../auth";
import { assistantUrl } from "../config";
import { AssistantError } from "../http";
import { assistantChannelLimit } from "../policy";
import { candidateSchema,exchangeMetaCode,requiredScopes,verifyAndSubscribe,graph } from "./graph";
import { openMeta,requireMeta,requireWhatsApp,sealMeta,type SocialProvider } from "./security";
import { verifyWhatsAppNumber } from "./whatsapp";
export const safeConnectionSelect={id:true,provider:true,accountId:true,displayName:true,status:true,enabled:true,tokenExpiresAt:true,autoMessages:true,autoComments:true,lastError:true,connectedAt:true} as const;
export async function metaSessionHash(){const token=(await cookies()).get(ASSISTANT_COOKIE)?.value;if(!token)throw new AssistantError("Please sign in again.",401);return sha256(token);}
export async function beginMetaConnection(workspaceId:string,userId:string,provider:SocialProvider,withComments:boolean){
 if(provider==="WHATSAPP")throw new AssistantError("Use the WhatsApp connect button.");
 const c=requireMeta(),state=createOpaqueToken(),sessionHash=await metaSessionHash();
 await db.assistantMetaFlow.deleteMany({where:{workspaceId,userId}});
 await db.assistantMetaFlow.create({data:{workspaceId,userId,provider,withComments,stateHash:sha256(state),sessionHash,expiresAt:new Date(Date.now()+20*60000)}});
 const url=new URL(`https://www.facebook.com/${c.version}/dialog/oauth`);url.searchParams.set("client_id",c.appId);url.searchParams.set("redirect_uri",c.callback);url.searchParams.set("state",state);url.searchParams.set("response_type","code");url.searchParams.set("scope",requiredScopes(provider,withComments).join(","));url.searchParams.set("auth_type","rerequest");if(c.loginConfigId)url.searchParams.set("config_id",c.loginConfigId);return url.href;
}
export async function finishMetaAuthorization(state:string,code:string,userId:string){
 const stateHash=sha256(state),sessionHash=await metaSessionHash(),now=new Date();const flow=await db.assistantMetaFlow.findUnique({where:{stateHash}});
 if(!flow||flow.userId!==userId||flow.sessionHash!==sessionHash||flow.phase!=="AUTHORIZING"||flow.expiresAt<=now)throw new AssistantError("This connection link expired or belongs to another sign-in. Start again from Connections.",409);
 // Consume the code before any external call; callbacks cannot be replayed.
 if(!(await db.assistantMetaFlow.updateMany({where:{id:flow.id,phase:"AUTHORIZING",expiresAt:{gt:now}},data:{phase:"EXCHANGING"}})).count)throw new AssistantError("This connection link has already been used.",409);
 const candidates=await exchangeMetaCode(code,flow.provider as SocialProvider,flow.withComments);await db.assistantMetaFlow.update({where:{id:flow.id},data:{phase:"SELECTING",candidatesCiphertext:sealMeta(candidates,`flow:${flow.id}`)}});return flow;
}
export async function pendingMetaChoices(workspaceId:string,userId:string){
 const flow=await db.assistantMetaFlow.findFirst({where:{workspaceId,userId,sessionHash:await metaSessionHash(),phase:"SELECTING",expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"}});if(!flow?.candidatesCiphertext)return null;
 try{const candidates=z.array(candidateSchema).parse(openMeta(flow.candidatesCiphertext,`flow:${flow.id}`));return {id:flow.id,provider:flow.provider,choices:candidates.map(c=>({id:c.accountId,name:c.name,requiresRegistration:c.requiresRegistration||false}))};}catch{await db.assistantMetaFlow.deleteMany({where:{id:flow.id}});return null;}
}
export async function chooseMetaAccount(workspaceId:string,userId:string,flowId:string,accountId:string,pin?:string){
 requireMeta();const flow=await db.assistantMetaFlow.findFirst({where:{id:flowId,workspaceId,userId,sessionHash:await metaSessionHash(),phase:"SELECTING",expiresAt:{gt:new Date()}}});if(!flow?.candidatesCiphertext)throw new AssistantError("This connection link expired. Connect again.",409);
 const candidates=z.array(candidateSchema).parse(openMeta(flow.candidatesCiphertext,`flow:${flow.id}`)),candidate=candidates.find(c=>c.accountId===accountId);if(!candidate)throw new AssistantError("Choose an account authorised in Meta.",403);
 const existing=await db.assistantSocialConnection.findUnique({where:{provider_accountId:{provider:flow.provider,accountId}}});if(existing&&existing.workspaceId!==workspaceId)throw new AssistantError("This account is already linked to another business. Contact support before moving it.",409);
 const eligible=await db.assistantWorkspace.findUniqueOrThrow({where:{id:workspaceId}});if(new Set([...eligible.channels,flow.provider]).size>assistantChannelLimit(eligible))throw new AssistantError("Your plan includes fewer channels. Disconnect another channel before connecting this one.",409);
 if(flow.provider==="WHATSAPP")await verifyWhatsAppNumber(candidate,pin);else await verifyAndSubscribe(candidate,flow.provider as SocialProvider,flow.withComments);
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
  const workspace=await tx.assistantWorkspace.findUniqueOrThrow({where:{id:workspaceId}}),channels=[...new Set([...workspace.channels,flow.provider])];if(channels.length>assistantChannelLimit(workspace))throw new AssistantError("Your plan includes fewer channels. Disable website chat or disconnect another channel first.",409);
  if(!(await tx.assistantMetaFlow.updateMany({where:{id:flow.id,phase:"SELECTING",expiresAt:{gt:new Date()}},data:{phase:"COMPLETE",candidatesCiphertext:null}})).count)throw new AssistantError("This connection has already been completed.",409);
  const current=await tx.assistantSocialConnection.findFirst({where:{workspaceId,provider:flow.provider,status:{in:["CONNECTED","REAUTH_REQUIRED"]}}});if(current&&current.accountId!==accountId)throw new AssistantError("Disconnect the existing account before choosing a different one.",409);
  const id=existing?.id||randomUUID();await tx.assistantSocialConnection.upsert({where:{provider_accountId:{provider:flow.provider,accountId}},create:{id,workspaceId,provider:flow.provider,accountId,whatsAppAccountId:flow.provider==="WHATSAPP"?candidate.pageId:null,tokenExpiresAt:candidate.expiresAt?new Date(candidate.expiresAt):null,pageId:flow.provider==="WHATSAPP"?candidate.accountId:candidate.pageId,displayName:candidate.name,authorizingUserId:candidate.authorizingUserId,tokenCiphertext:sealMeta(candidate.token,`connection:${id}`),grantedScopes:candidate.scopes},update:{enabled:false,whatsAppAccountId:flow.provider==="WHATSAPP"?candidate.pageId:null,tokenExpiresAt:candidate.expiresAt?new Date(candidate.expiresAt):null,displayName:candidate.name,pageId:flow.provider==="WHATSAPP"?candidate.accountId:candidate.pageId,authorizingUserId:candidate.authorizingUserId,tokenCiphertext:sealMeta(candidate.token,`connection:${id}`),grantedScopes:candidate.scopes,status:"CONNECTED",autoMessages:false,autoComments:false,lastError:null,connectedAt:new Date()}});
  await tx.assistantWorkspace.update({where:{id:workspaceId},data:{channels}});
 });return assistantUrl(`/account?business=${workspaceId}&meta=connected`);
}
export async function disconnectMeta(workspaceId:string,connectionId:string){
 const connection=await db.assistantSocialConnection.findFirst({where:{id:connectionId,workspaceId}});if(!connection)throw new AssistantError("Connection not found.",404);
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
  await tx.assistantSocialConnection.update({where:{id:connectionId},data:{status:"DISCONNECTED",enabled:false,tokenCiphertext:null,autoMessages:false,autoComments:false}});
  await tx.assistantSocialEvent.updateMany({where:{connectionId,status:{in:["PENDING","GENERATING","READY"]}},data:{status:"SKIPPED",errorCode:"DISCONNECTED"}});
  const workspace=await tx.assistantWorkspace.findUniqueOrThrow({where:{id:workspaceId}});await tx.assistantWorkspace.update({where:{id:workspaceId},data:{channels:(await tx.assistantSocialConnection.count({where:{workspaceId,provider:connection.provider,status:{in:["CONNECTED","REAUTH_REQUIRED"]}}}))?workspace.channels:workspace.channels.filter(c=>c!==connection.provider)}});
  await tx.assistantMetaFlow.deleteMany({where:{workspaceId,provider:connection.provider}});
 });
 if(connection.provider==="WHATSAPP"&&connection.tokenCiphertext&&connection.whatsAppAccountId&&!(await db.assistantSocialConnection.count({where:{provider:"WHATSAPP",whatsAppAccountId:connection.whatsAppAccountId,status:"CONNECTED"}}))){try{await graph(`${connection.whatsAppAccountId}/subscribed_apps`,z.string().parse(openMeta(connection.tokenCiphertext,`connection:${connection.id}`)),"DELETE");}catch{/* Local disconnection still blocks all replies. */}}
 // The Page subscription is shared by FB and IG. Do not revoke it while the
 // other channel still uses it. Local disconnection always blocks replies.
 if(connection.provider!=="WHATSAPP"&&connection.tokenCiphertext&&!(await db.assistantSocialConnection.count({where:{pageId:connection.pageId,status:"CONNECTED"}}))){try{await graph(`${connection.pageId}/subscribed_apps`,z.string().parse(openMeta(connection.tokenCiphertext,`connection:${connection.id}`)),"DELETE");}catch{/* Revoked permissions already prevent remote unsubscription. */}}
}
export async function saveMetaPreferences(workspaceId:string,connectionId:string,autoMessages:boolean,autoComments:boolean){
 const c=await db.assistantSocialConnection.findFirst({where:{id:connectionId,workspaceId,status:"CONNECTED"}});if(!c)throw new AssistantError("Reconnect this account before enabling replies.",409);if(c.provider==="WHATSAPP"&&autoComments)throw new AssistantError("WhatsApp has private messages only.");if(autoComments&&requiredScopes(c.provider as SocialProvider,true).some(s=>!c.grantedScopes.includes(s)))throw new AssistantError("Reconnect with comment access before enabling comment replies.",409);
 await db.assistantSocialConnection.update({where:{id:c.id},data:{autoMessages,autoComments}});
}

export async function setSocialEnabled(workspaceId:string,connectionId:string,enabled:boolean){
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
  const connection=await tx.assistantSocialConnection.findFirst({where:{id:connectionId,workspaceId,status:"CONNECTED"}});if(!connection)throw new AssistantError("Reconnect this account before activating it.",409);
  if(enabled){requireMeta();if(connection.provider==="WHATSAPP")requireWhatsApp();}
  if(enabled&&!connection.autoMessages&&!connection.autoComments)throw new AssistantError("Choose and save at least one reply option before activating this channel.");
  if(enabled&&connection.tokenExpiresAt&&connection.tokenExpiresAt<=new Date())throw new AssistantError("Meta access expired. Reconnect this account.",409);
  await tx.assistantSocialConnection.update({where:{id:connectionId},data:{enabled,lastError:enabled?null:connection.lastError}});
  if(!enabled)await tx.assistantSocialEvent.updateMany({where:{connectionId,status:{in:["PENDING","GENERATING","READY"]},kind:{in:["MESSAGE","COMMENT"]}},data:{status:"SKIPPED",errorCode:"CHANNEL_PAUSED",leaseUntil:null}});
 });
}
