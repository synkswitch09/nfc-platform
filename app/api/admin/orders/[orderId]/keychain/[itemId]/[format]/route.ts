import { NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { isKeychainProduct, keychainInputFromOptions } from "@/lib/keychain-order";
import { generateKeychain } from "@/lib/keychain";
import { binaryStl, keychain3mf } from "@/lib/keychain-files";

export async function GET(_: Request, { params }: { params: Promise<{orderId:string;itemId:string;format:string}> }) {
  const context=await getAdminApiContext();if(!context)return new NextResponse("Forbidden",{status:403});
  const {orderId,itemId,format}=await params;
  if(!["model.3mf","base.stl","letters.stl"].includes(format))return new NextResponse("Not found",{status:404});
  const order=await db.order.findFirst({where:{id:orderId,storeId:context.store.id},select:{status:true,items:{where:{id:itemId},select:{personalisation:true,selectedOptions:true,variant:{select:{product:{select:{slug:true}}}}}}}});
  if(!order||!["PAID","PROCESSING","READY_TO_SHIP","SHIPPED","DELIVERED"].includes(order.status)||!order.items[0]||!isKeychainProduct(context.store.slug,order.items[0].variant.product.slug))return new NextResponse("Not found",{status:404});
  try{
    const input=keychainInputFromOptions(order.items[0].personalisation,order.items[0].selectedOptions);
    const output=format==="model.3mf"?keychain3mf(input):binaryStl(format==="base.stl"?generateKeychain(input).base:generateKeychain(input).letters);
    return new NextResponse(new Uint8Array(output),{headers:{"content-type":format.endsWith("3mf")?"model/3mf":"model/stl","content-disposition":`attachment; filename="kosykin-${itemId}-${format}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex"}});
  }catch{return new NextResponse("Model generation failed; review the order details.",{status:422})}
}
