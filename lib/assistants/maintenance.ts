import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { assistantConfig,assistantUrl } from "./config";
import { assistantAccess,DAY,retentionDeadline } from "./policy";
import { syncAssistantSubscription } from "./billing";
export async function maintainAssistants(now=new Date()){
 const config=assistantConfig(),stopAt=Date.now()+20000;let sent=0,deleted=0;
 const workspaces=await db.assistantWorkspace.findMany({where:{billingExempt:false,OR:[{trialEndsAt:{lte:new Date(now.getTime()+2*DAY)}},{retentionAt:{not:null}},{paidThrough:{lte:now}}]},orderBy:{updatedAt:"asc"},take:20});
 for(let workspace of workspaces){if(Date.now()>stopAt)break;if(workspace.stripeSubscriptionId){const stripe=getStripe();if(!stripe)continue;try{await syncAssistantSubscription(workspace.stripeSubscriptionId,stripe,workspace.id);workspace=await db.assistantWorkspace.findUniqueOrThrow({where:{id:workspace.id}});}catch{continue;}}
  const access=assistantAccess(workspace,now),link=assistantUrl(`/account?business=${workspace.id}`);
  if(access.reason==="trial"&&workspace.trialEndsAt&&workspace.trialEndsAt.getTime()-now.getTime()<=2*DAY)await db.assistantNotice.upsert({where:{workspaceId_noticeKey:{workspaceId:workspace.id,noticeKey:"trial-ending"}},create:{workspaceId:workspace.id,noticeKey:"trial-ending",subject:"Your assistant trial ends soon",text:`Your free trial for ${workspace.name} ends on ${workspace.trialEndsAt.toLocaleDateString("en-AU",{timeZone:"Australia/Adelaide"})}. No payment will be taken automatically. Choose a plan if you want to continue:\n${link}`},update:{}});
  if(access.active)continue;const ended=workspace.trialEndsAt&&workspace.trialEndsAt<=now?workspace.trialEndsAt:now,retention=workspace.retentionAt||retentionDeadline(ended);if(!workspace.retentionAt)await db.assistantWorkspace.update({where:{id:workspace.id},data:{retentionAt:retention}});
  const days=Math.ceil((retention.getTime()-now.getTime())/DAY),key=days<=7?"final-retention":days<=30?"retention-30":"paused";
  await db.assistantNotice.upsert({where:{workspaceId_noticeKey:{workspaceId:workspace.id,noticeKey:`${key}:${retention.toISOString()}`}},create:{workspaceId:workspace.id,noticeKey:`${key}:${retention.toISOString()}`,subject:key==="paused"?"Your assistant has paused":"Your assistant information is scheduled for deletion",text:`${workspace.name} is not currently answering customers. Your configuration is retained for reactivation until ${retention.toLocaleDateString("en-AU",{timeZone:"Australia/Adelaide"})}. We will not delete it until at least seven days after a final notice has been delivered. Your other Tapkin and Kosykin accounts or orders are not affected.\nManage your assistant:\n${link}`},update:{}});
  // Never delete while checkout is unresolved, billing can continue, or a
  // final notice has not actually been delivered at least seven days ago.
  if(config.allowDeletion&&retention<=now&&workspace.finalNoticeAt&&workspace.finalNoticeAt.getTime()<=now.getTime()-7*DAY&&(!workspace.stripeSubscriptionId||["canceled","incomplete_expired"].includes(workspace.stripeStatus||""))&&!workspace.checkoutSessionId)deleted+=(await db.assistantWorkspace.deleteMany({where:{id:workspace.id,billingExempt:false,retentionAt:{lte:now},finalNoticeAt:{lte:new Date(now.getTime()-7*DAY)},checkoutSessionId:null,checkoutLockUntil:null,OR:[{stripeSubscriptionId:null},{stripeStatus:{in:["canceled","incomplete_expired"]}}]}})).count;
 }
 const notices=await db.assistantNotice.findMany({where:{sentAt:null,attempts:{lt:10},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},include:{workspace:{include:{owner:{select:{email:true}}}}},take:10,orderBy:{createdAt:"asc"}});
 for(const notice of notices){if(Date.now()>stopAt)break;if(assistantAccess(notice.workspace,now).active&&notice.noticeKey!=="trial-ending"){await db.assistantNotice.delete({where:{id:notice.id}});continue;}const leaseToken=randomUUID();if(!(await db.assistantNotice.updateMany({where:{id:notice.id,sentAt:null,OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},data:{leaseToken,leaseUntil:new Date(now.getTime()+5*60000),attempts:{increment:1}}})).count)continue;
  try{const delivered=await sendTransactionalEmail({storeSlug:config.emailStore,to:notice.workspace.owner.email,subject:notice.subject,text:notice.text,idempotencyKey:`assistant-notice:${notice.id}`});if(delivered){await db.assistantNotice.update({where:{id:notice.id},data:{sentAt:now,leaseUntil:null,leaseToken:null}});sent++;if(notice.noticeKey.startsWith("final-retention:"))await db.assistantWorkspace.updateMany({where:{id:notice.workspaceId,finalNoticeAt:null},data:{finalNoticeAt:now}});}else await db.assistantNotice.update({where:{id:notice.id},data:{leaseUntil:null,leaseToken:null}});}catch{await db.assistantNotice.updateMany({where:{id:notice.id,leaseToken},data:{leaseUntil:null,leaseToken:null}});}
 }
 await db.assistantSession.deleteMany({where:{expiresAt:{lt:now}}});await db.assistantAuthToken.deleteMany({where:{expiresAt:{lt:now}}});return {examined:workspaces.length,sent,deleted};
}
