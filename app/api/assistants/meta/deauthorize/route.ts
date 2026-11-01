import { NextRequest,NextResponse } from "next/server";
import { signedMetaUser } from "@/lib/assistants/meta/security";
import { revokeMetaUser } from "@/lib/assistants/meta/revoke";
export async function POST(request:NextRequest){try{const raw=await request.text();if(raw.length>20000)return new NextResponse(null,{status:413});const signed=new URLSearchParams(raw).get("signed_request")||"",userId=signedMetaUser(signed);await revokeMetaUser(userId);return NextResponse.json({received:true});}catch{return NextResponse.json({error:"Request could not be processed"},{status:400});}}
