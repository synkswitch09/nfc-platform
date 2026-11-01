import { createHmac } from "node:crypto";
import { z } from "zod";
import { AssistantError } from "../http";
import { metaId,requireMeta,type SocialProvider } from "./security";
export class MetaGraphError extends AssistantError {constructor(readonly code:number,readonly uncertain=false){super(code===190?"Meta access has expired or was revoked. Reconnect this account.":uncertain?"Delivery could not be confirmed. Check Meta before sending again.":"Meta could not complete this action. Check the account permissions or reconnect.",409);}}
const id=z.string().regex(/^\d{1,40}$/);
export const candidateSchema=z.object({accountId:id,pageId:id,name:z.string().max(300),token:z.string().min(1).max(8192),authorizingUserId:id,scopes:z.array(z.string()).max(100),requiresRegistration:z.boolean().optional(),expiresAt:z.string().datetime().optional()});
export type MetaCandidate=z.infer<typeof candidateSchema>;
export function requiredScopes(provider:SocialProvider,comments:boolean){if(provider==="WHATSAPP")return ["whatsapp_business_management","whatsapp_business_messaging"];return ["pages_show_list","pages_manage_metadata","pages_read_engagement",...(provider==="FACEBOOK"?["pages_messaging"]:["instagram_basic","instagram_manage_messages"]),...(comments?(provider==="FACEBOOK"?["pages_manage_engagement","pages_read_user_content"]:["instagram_manage_comments"]):[])];}
// Never accept provider URLs or follow pagination links; every request stays on
// the fixed Graph host. Errors never expose request URLs, tokens or Meta bodies.
export async function graph(path:string,token:string|undefined,method="GET",params:Record<string,unknown>={}){
 const c=requireMeta();if(!/^[a-zA-Z0-9_/-]+$/.test(path))throw new MetaGraphError(100);const url=new URL(`https://graph.facebook.com/${c.version}/${path}`),payload={...params};
 if(token)url.searchParams.set("appsecret_proof",createHmac("sha256",c.appSecret).update(token).digest("hex"));
 const headers:Record<string,string>={};if(token)headers.authorization=`Bearer ${token}`;
 let body:string|undefined;if(method==="GET"){for(const [k,v] of Object.entries(payload))url.searchParams.set(k,String(v));}else{headers["content-type"]="application/json";body=JSON.stringify(payload);}
 let response:Response;try{response=await fetch(url,{method,headers,body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});}catch{throw new MetaGraphError(0,method!=="GET");}
 const raw=await response.text().catch(()=>"");if(raw.length>750000)throw new MetaGraphError(0,method!=="GET");let data;try{data=JSON.parse(raw);}catch{throw new MetaGraphError(0,method!=="GET");}if(!response.ok||data.error)throw new MetaGraphError(Number(data.error?.code)||response.status,response.status>=500&&method!=="GET");return data;
}
export async function exchangeMetaCode(code:string,provider:SocialProvider,comments:boolean){
 if(provider==="WHATSAPP")throw new AssistantError("Use WhatsApp Embedded Signup to connect this channel.");
 const c=requireMeta(),short=await graph("oauth/access_token",undefined,"GET",{client_id:c.appId,client_secret:c.appSecret,redirect_uri:c.callback,code});const first=z.object({access_token:z.string().min(1).max(8192)}).parse(short);
 const long=z.object({access_token:z.string().min(1).max(8192)}).parse(await graph("oauth/access_token",undefined,"GET",{grant_type:"fb_exchange_token",client_id:c.appId,client_secret:c.appSecret,fb_exchange_token:first.access_token}));
 const user=z.object({id}).parse(await graph("me",long.access_token,"GET",{fields:"id"}));
 const permissionData=z.object({data:z.array(z.object({permission:z.string(),status:z.string()})).max(100)}).parse(await graph("me/permissions",long.access_token));const scopes=permissionData.data.filter(p=>p.status==="granted").map(p=>p.permission);
 if(requiredScopes(provider,comments).some(scope=>!scopes.includes(scope)))throw new AssistantError("Some required permissions were declined. Reconnect and allow the requested access.",409);
 const candidates:MetaCandidate[]=[];let after:string|undefined;
 for(let page=0;page<5;page++){
  const result=z.object({data:z.array(z.object({id,name:z.string(),access_token:z.string(),tasks:z.array(z.string()).optional(),instagram_business_account:z.object({id,username:z.string().optional()}).optional()})).max(100),paging:z.object({next:z.string().optional(),cursors:z.object({after:z.string().max(3000).optional()}).optional()}).optional()}).parse(await graph("me/accounts",long.access_token,"GET",{fields:"id,name,access_token,tasks,instagram_business_account{id,username}",limit:100,...(after?{after}:{})}));
  for(const item of result.data){if(!item.tasks?.some(t=>["MANAGE","MODERATE","MESSAGING","MESSAGE"].includes(t)))continue;if(provider==="INSTAGRAM"&&!item.instagram_business_account)continue;candidates.push(candidateSchema.parse({accountId:provider==="INSTAGRAM"?item.instagram_business_account!.id:item.id,pageId:item.id,name:provider==="INSTAGRAM"?item.instagram_business_account!.username||item.name:item.name,token:item.access_token,authorizingUserId:user.id,scopes}));}
  if(!result.paging?.next)break;if(page===4)throw new AssistantError("Too many pages were authorised. Reconnect and select only the pages needed for this business.");after=result.paging.cursors?.after;if(!after)throw new MetaGraphError(100);
 }
 if(!candidates.length)throw new AssistantError(provider==="INSTAGRAM"?"No linked professional Instagram account was found. Link it to a Facebook Page you manage and try again.":"No eligible Facebook Page was found. Sign in with an account that manages your business Page.",409);return candidates;
}
export async function verifyAndSubscribe(candidate:MetaCandidate,provider:SocialProvider,comments:boolean){
 if(provider==="WHATSAPP")throw new AssistantError("Use the WhatsApp account verification flow.");
 const page=z.object({id,instagram_business_account:z.object({id}).optional()}).parse(await graph("me",candidate.token,"GET",{fields:provider==="INSTAGRAM"?"id,instagram_business_account":"id"}));if(page.id!==candidate.pageId||(provider==="INSTAGRAM"&&page.instagram_business_account?.id!==candidate.accountId))throw new MetaGraphError(100);
 // Facebook Login uses the Page edge. Instagram fields are configured on the
 // Instagram webhook object in the app dashboard, NOT in subscribed_fields.
 const previous=await graph(`${candidate.pageId}/subscribed_apps`,candidate.token);const fields=new Set<string>(previous.data?.find((app:{id:string})=>app.id===requireMeta().appId)?.subscribed_fields||[]);for(const field of ["messages","message_echoes",...(provider==="FACEBOOK"&&comments?["feed"]:[])])fields.add(field);
 const subscription=await graph(`${candidate.pageId}/subscribed_apps`,candidate.token,"POST",{subscribed_fields:[...fields]});if(subscription.success!==true)throw new MetaGraphError(100);
}
export async function sendMetaReply(connection:{provider:string;pageId:string},token:string,kind:string,target:string,text:string){
 if(!text.trim()||text.length>990)throw new AssistantError("Social replies must contain between 1 and 990 characters.");
 if(kind==="COMMENT"&&!/^\d+(?:_\d+)?$/.test(target))throw new MetaGraphError(100);if(kind!=="COMMENT"&&!metaId(target))throw new MetaGraphError(100);
 if(connection.provider==="WHATSAPP"){
  if(kind!=="MESSAGE"||!/^\d{6,20}$/.test(target))throw new MetaGraphError(100);
  const result=await graph(`${connection.pageId}/messages`,token,"POST",{messaging_product:"whatsapp",recipient_type:"individual",to:target,type:"text",text:{body:text,preview_url:false}});const messageId=result.messages?.[0]?.id;if(typeof messageId!=="string"||!messageId||messageId.length>1000)throw new MetaGraphError(0,true);return messageId;
 }
 const path=kind==="COMMENT"?`${target}/${connection.provider==="INSTAGRAM"?"replies":"comments"}`:`${connection.pageId}/messages`;
 const body=kind==="COMMENT"?{message:text}:{recipient:{id:target},message:{text},...(connection.provider==="FACEBOOK"?{messaging_type:"RESPONSE"}:{})};
 const result=await graph(path,token,"POST",body);const messageId=kind==="COMMENT"?result.id:result.message_id;if(typeof messageId!=="string"||!messageId||messageId.length>1000)throw new MetaGraphError(0,true);return messageId;
}
