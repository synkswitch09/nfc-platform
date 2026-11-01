import { z } from "zod";
import { db } from "@/lib/db";
import { createOpaqueToken,sha256 } from "@/lib/crypto";
import { AssistantError } from "../http";
import { graph,candidateSchema,requiredScopes,MetaGraphError,type MetaCandidate } from "./graph";
import { metaConfig,requireWhatsApp,sealMeta } from "./security";
import { metaSessionHash } from "./connections";
const id=z.string().regex(/^\d{1,40}$/);
const phoneSchema=z.object({id,display_phone_number:z.string().max(100),verified_name:z.string().max(200).optional(),status:z.string(),is_on_biz_app:z.boolean().optional()});
async function phoneNumbers(wabaId:string,token:string){
 const phones:z.infer<typeof phoneSchema>[]=[];let after:string|undefined;
 for(let page=0;page<5;page++){
  const result=z.object({data:z.array(phoneSchema).max(100),paging:z.object({next:z.string().optional(),cursors:z.object({after:z.string().max(3000).optional()}).optional()}).optional()}).parse(await graph(`${wabaId}/phone_numbers`,token,"GET",{fields:"id,display_phone_number,verified_name,status,is_on_biz_app",limit:100,...(after?{after}:{})}));phones.push(...result.data);
  if(!result.paging?.next)return phones;if(page===4||!result.paging.cursors?.after)throw new AssistantError("Select fewer phone numbers in Meta and reconnect.");after=result.paging.cursors.after;
 }return phones;
}
export async function exchangeWhatsAppCode(code:string,wabaHint?:string){
 requireWhatsApp();const c=metaConfig();
 // Embedded Signup returns a business token, not a short-lived Facebook user
 // token. Never perform the Facebook user-token long-lived exchange here.
 const token=z.object({access_token:z.string().min(1).max(8192)}).parse(await graph("oauth/access_token",undefined,"GET",{client_id:c.appId,client_secret:c.appSecret,code})).access_token;
 const debug=z.object({data:z.object({app_id:id,is_valid:z.boolean(),user_id:id,scopes:z.array(z.string()),expires_at:z.number().optional(),data_access_expires_at:z.number().optional(),granular_scopes:z.array(z.object({scope:z.string(),target_ids:z.array(id).optional()})).optional()})}).parse(await graph("debug_token",`${c.appId}|${c.appSecret}`,"GET",{input_token:token})).data;
 const now=Date.now()/1000;if(!debug.is_valid||debug.app_id!==c.appId||requiredScopes("WHATSAPP",false).some(scope=>!debug.scopes.includes(scope))||(debug.expires_at&&debug.expires_at<=now)||(debug.data_access_expires_at&&debug.data_access_expires_at<=now))throw new AssistantError("Meta did not grant the required WhatsApp access. Reconnect and allow both WhatsApp permissions.",409);
 const targets=[...new Set(debug.granular_scopes?.filter(g=>g.scope==="whatsapp_business_management").flatMap(g=>g.target_ids||[])||[])];
 if(wabaHint&&targets.length&&!targets.includes(wabaHint))throw new AssistantError("The selected WhatsApp account was not authorised by this connection.",403);
 const accounts=wabaHint?[id.parse(wabaHint)]:targets;if(!accounts.length||accounts.length>20)throw new AssistantError("Choose your WhatsApp business account in Meta and complete the connection again.",409);
 const expiry=[debug.expires_at,debug.data_access_expires_at].filter((n):n is number=>Boolean(n&&n>0));const expiresAt=expiry.length?new Date(Math.min(...expiry)*1000).toISOString():undefined,candidates:MetaCandidate[]=[];
 for(const wabaId of accounts){
  // A browser asset ID is only a hint. The app-bound customer token must be
  // able to read this account's actual phone-number collection on the server.
  for(const phone of await phoneNumbers(wabaId,token)){
   if(phone.is_on_biz_app)continue; // Coexistence requires a separate history-sync implementation.
   candidates.push(candidateSchema.parse({accountId:phone.id,pageId:wabaId,name:`${phone.verified_name||"WhatsApp"} · ${phone.display_phone_number}`,token,authorizingUserId:debug.user_id,scopes:debug.scopes,requiresRegistration:phone.status!=="CONNECTED",expiresAt}));
  }
 }
 if(!candidates.length)throw new AssistantError("No eligible Cloud API number was found. This connection currently supports dedicated WhatsApp Business Platform numbers; existing WhatsApp Business app coexistence is not supported yet.",409);return candidates;
}
export async function beginWhatsAppConnection(workspaceId:string,userId:string){
 const config=requireWhatsApp(),state=createOpaqueToken();await db.assistantMetaFlow.deleteMany({where:{workspaceId,userId}});
 const flow=await db.assistantMetaFlow.create({data:{workspaceId,userId,provider:"WHATSAPP",sessionHash:await metaSessionHash(),stateHash:sha256(state),expiresAt:new Date(Date.now()+20*60000)}});
 return {flowId:flow.id,state,appId:config.appId,configId:config.configId,version:config.version};
}
export async function finishWhatsAppAuthorization(workspaceId:string,userId:string,flowId:string,state:string,code:string,wabaHint?:string){
 requireWhatsApp();const flow=await db.assistantMetaFlow.findFirst({where:{id:flowId,workspaceId,userId,provider:"WHATSAPP",stateHash:sha256(state),sessionHash:await metaSessionHash(),phase:"AUTHORIZING",expiresAt:{gt:new Date()}}});if(!flow)throw new AssistantError("This WhatsApp connection expired or belongs to another sign-in. Connect again.",409);
 if(!(await db.assistantMetaFlow.updateMany({where:{id:flow.id,phase:"AUTHORIZING",expiresAt:{gt:new Date()}},data:{phase:"EXCHANGING"}})).count)throw new AssistantError("This connection has already been used.",409);
 const candidates=await exchangeWhatsAppCode(code,wabaHint);await db.assistantMetaFlow.update({where:{id:flow.id},data:{phase:"SELECTING",candidatesCiphertext:sealMeta(candidates,`flow:${flow.id}`)}});return {saved:true};
}
export async function verifyWhatsAppNumber(candidate:MetaCandidate,pin?:string){
 requireWhatsApp();if(candidate.expiresAt&&new Date(candidate.expiresAt)<=new Date())throw new AssistantError("Meta access expired. Reconnect WhatsApp.",409);
 const phone=(await phoneNumbers(candidate.pageId,candidate.token)).find(p=>p.id===candidate.accountId);if(!phone)throw new AssistantError("This number is no longer authorised for the selected WhatsApp account.",403);
 if(phone.is_on_biz_app)throw new AssistantError("WhatsApp Business app coexistence is not supported by this connection yet.",409);
 if(phone.status!=="CONNECTED"){
  if(!pin||!/^\d{6}$/.test(pin))throw new AssistantError("Enter a six-digit two-step verification PIN to register this number. Keep it safe; it is not saved in the assistant.");
  const registration=await graph(`${candidate.accountId}/register`,candidate.token,"POST",{messaging_product:"whatsapp",pin});if(registration.success!==true)throw new MetaGraphError(100);
 }
 const verified=z.object({id,status:z.string()}).parse(await graph(candidate.accountId,candidate.token,"GET",{fields:"id,status"}));if(verified.id!==candidate.accountId||verified.status!=="CONNECTED")throw new AssistantError("Meta has not finished activating this number. Check WhatsApp Manager and try again.",409);
 const subscription=await graph(`${candidate.pageId}/subscribed_apps`,candidate.token,"POST");if(subscription.success!==true)throw new MetaGraphError(100);
}
