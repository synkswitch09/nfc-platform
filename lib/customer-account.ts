import { db } from "@/lib/db";
export async function claimVerifiedGuestOrders(user:{id:string;email:string;emailVerifiedAt:Date|null},storeId:string){
 if(!user.emailVerifiedAt)return 0;
 // A verified email is the ownership proof; use a conditional update to prevent races.
 const result=await db.order.updateMany({where:{storeId,userId:null,guestEmail:{equals:user.email,mode:"insensitive"},status:{notIn:["PENDING","PAYMENT_PENDING"]}},data:{userId:user.id,claimedAt:new Date(),claimTokenHash:null,claimExpiresAt:null}});
 if(result.count)await db.auditLog.create({data:{actorId:user.id,storeId,action:"VERIFIED_GUEST_ORDERS_LINKED",entityType:"User",entityId:user.id,metadata:{count:result.count}}});
 return result.count;
}
