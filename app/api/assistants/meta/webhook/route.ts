import { after,NextRequest,NextResponse } from "next/server";
import { metaConfig,secureEqual,validMetaSignature } from "@/lib/assistants/meta/security";
import { processMetaQueue,receiveMetaEvents } from "@/lib/assistants/meta/queue";
export const runtime="nodejs";
export const maxDuration=120;
export async function GET(request:NextRequest){const c=metaConfig(),q=request.nextUrl.searchParams,challenge=q.get("hub.challenge")||"";if(c.verifyToken.length<32||q.get("hub.mode")!=="subscribe"||!secureEqual(q.get("hub.verify_token")||"",c.verifyToken)||!/^\d{1,100}$/.test(challenge))return new NextResponse("Forbidden",{status:403});return new NextResponse(challenge,{headers:{"cache-control":"no-store"}});}
export async function POST(request:NextRequest){
 if(!metaConfig().ready)return NextResponse.json({error:"Social connections unavailable"},{status:503});
 // Bound memory even for chunked requests; validate raw bytes before touching DB.
 const reader=request.body?.getReader();if(!reader)return new NextResponse(null,{status:400});const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2*1024*1024){await reader.cancel();return new NextResponse(null,{status:413});}chunks.push(part.value);}
 const raw=Buffer.concat(chunks).toString("utf8");if(!validMetaSignature(raw,request.headers.get("x-hub-signature-256")))return new NextResponse(null,{status:403});
 let payload;try{payload=JSON.parse(raw);}catch{return new NextResponse(null,{status:400});}
 try{await receiveMetaEvents(payload);}catch{return NextResponse.json({error:"Notification could not be stored"},{status:500});}
 after(async()=>{try{await processMetaQueue(2);}catch{/* Durable events remain for the authenticated recovery worker. */}});
 return NextResponse.json({received:true});
}
