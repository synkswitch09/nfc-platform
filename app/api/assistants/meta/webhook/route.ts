import { randomUUID } from "node:crypto";
import { after,NextRequest,NextResponse } from "next/server";
import { metaConfig,secureEqual,validMetaSignature } from "@/lib/assistants/meta/security";
import { processMetaQueue,receiveMetaEvents } from "@/lib/assistants/meta/queue";
export const runtime="nodejs";
export const maxDuration=120;
export async function GET(request:NextRequest){const c=metaConfig(),q=request.nextUrl.searchParams,challenge=q.get("hub.challenge")||"";if(c.verifyToken.length<32||q.get("hub.mode")!=="subscribe"||!secureEqual(q.get("hub.verify_token")||"",c.verifyToken)||!/^\d{1,100}$/.test(challenge))return new NextResponse("Forbidden",{status:403});return new NextResponse(challenge,{headers:{"cache-control":"no-store"}});}
// Keep logs bounded: never include payloads, account/contact IDs, headers or errors.
function logWebhook(requestId:string,event:string,details:Record<string,string|number|boolean>={}){
 console.info("[meta-webhook]",JSON.stringify({requestId,event,...details}));
}
export async function POST(request:NextRequest){
 const requestId=randomUUID();
 logWebhook(requestId,"received");
 const reject=(status:number,reason:string)=>{
  logWebhook(requestId,"rejected",{status,reason});
  return new NextResponse(null,{status});
 };
 if(!metaConfig().ready){
  logWebhook(requestId,"rejected",{status:503,reason:"configuration_unavailable"});
  return NextResponse.json({error:"Social connections unavailable"},{status:503});
 }
 // Bound memory even for chunked requests; validate raw bytes before touching DB.
 const reader=request.body?.getReader();if(!reader)return reject(400,"empty_body");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){
  const part=await reader.read();if(part.done)break;
  size+=part.value.length;
  if(size>2*1024*1024){await reader.cancel();return reject(413,"body_too_large");}
  chunks.push(part.value);
 }
 const raw=Buffer.concat(chunks).toString("utf8");
 if(!validMetaSignature(raw,request.headers.get("x-hub-signature-256")))return reject(403,"invalid_signature");
 let payload;try{payload=JSON.parse(raw);}catch{return reject(400,"invalid_json");}
 let stored:number;
 try{stored=await receiveMetaEvents(payload);}catch{
  logWebhook(requestId,"rejected",{status:500,reason:"notification_storage_failed"});
  return NextResponse.json({error:"Notification could not be stored"},{status:500});
 }
 // Only allow known object labels into logs, never arbitrary input strings.
 const object=payload?.object;
 logWebhook(requestId,"accepted",{status:200,bytes:size,object:["page","instagram","whatsapp_business_account"].includes(object)?object:"other",stored});
 after(async()=>{
  try{
   const result=await processMetaQueue(2);
   logWebhook(requestId,"queue_completed",{processed:result.processed});
  }catch{
   // Durable events remain for the authenticated recovery worker.
   logWebhook(requestId,"queue_failed");
  }
 });
 return NextResponse.json({received:true});
}
