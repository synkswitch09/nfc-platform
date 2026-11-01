export const DAY=86400000;
export type AccessWorkspace={billingExempt:boolean;stripeStatus:string|null;paidThrough:Date|null;trialEndsAt:Date|null;trialChannel:string|null;planKey:string;pausedAt:Date|null};
export function assistantAccess(workspace:AccessWorkspace,now=new Date()){
 if(workspace.pausedAt)return {active:false,reason:"paused",period:"paused",limit:0,channels:0};
 if(workspace.billingExempt)return {active:true,reason:"internal",period:now.toISOString().slice(0,7),limit:10000,channels:3};
 if(workspace.stripeStatus==="active"&&workspace.paidThrough&&workspace.paidThrough>now)return {active:true,reason:"paid",period:`paid:${workspace.paidThrough.toISOString()}`,limit:workspace.planKey==="agenda"?1500:1000,channels:workspace.planKey==="agenda"?2:1};
 if(!workspace.stripeStatus&&workspace.trialEndsAt&&workspace.trialEndsAt>now)return {active:true,reason:"trial",period:"trial",limit:100,channels:1};
 return {active:false,reason:workspace.trialEndsAt?"expired":"setup",period:"inactive",limit:0,channels:0};
}
export function retentionDeadline(end:Date){return new Date(end.getTime()+90*DAY);}
export function canEditAssistant(user:{id:string;role:string},workspace:{ownerId:string}){return user.role==="ADMIN"||user.id===workspace.ownerId;}

export function assistantChannelLimit(workspace:AccessWorkspace){return workspace.billingExempt?3:workspace.stripeStatus==="active"&&workspace.planKey==="agenda"?2:1;}
