import {NextRequest,NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {getAdminApiContext,hasPermission} from "@/lib/admin";
import {getCurrentStorefront} from "@/lib/storefront";
import {db} from "@/lib/db";
import {jsonError} from "@/lib/http";
import {attachmentSchema,validSupportPhoto} from "@/lib/support-attachments";
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;index:string}>}){const [user,store,{id,index}]=await Promise.all([getCurrentUser(),getCurrentStorefront(),params]);if(!user)return jsonError("Unauthorised",401);const context=await getAdminApiContext("support.read");const support=await db.orderSupportRequest.findFirst({where:{id,storeId:store.id,...(hasPermission(context,"support.read")?{}:{order:{userId:user.id}})},select:{attachments:true}});const n=Number(index);if(!support||!Number.isInteger(n)||n<0||n>2||!Array.isArray(support.attachments))return jsonError("Not found",404);const photo=attachmentSchema.safeParse(support.attachments[n]);if(!photo.success||!validSupportPhoto(photo.data))return jsonError("Not found",404);return new NextResponse(Buffer.from(photo.data.data,"base64"),{headers:{"content-type":photo.data.type,"cache-control":"private, no-store","x-content-type-options":"nosniff","content-disposition":"inline"}});}
