import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { assistantConfig,assistantUrl } from "./config";
import { AssistantError } from "./http";
import { retentionDeadline } from "./policy";
const stripeId=(value:string|{id:string}|null)=>typeof value==="string"?value:value?.id;
export async function syncAssistantSubscription(subscriptionId:string,stripe:Stripe,expectedWorkspaceId?:string){
 const started=new Date();const sub=await stripe.subscriptions.retrieve(subscriptionId,{expand:["latest_invoice"]},{timeout:10000});
 if(sub.metadata.service!=="assistants")throw new AssistantError("This subscription does not belong to the assistant service.");const id=sub.metadata.workspaceId;
 if(expectedWorkspaceId&&id!==expectedWorkspaceId)throw new AssistantError("Subscription does not match this business.",403);
 const workspace=await db.assistantWorkspace.findUnique({where:{id}});if(!workspace||stripeId(sub.customer)!==workspace.stripeCustomerId)throw new AssistantError("Subscription customer does not match this business.",403);
 if(workspace.stripeSubscriptionId&&workspace.stripeSubscriptionId!==sub.id&&!["canceled","incomplete_expired"].includes(workspace.stripeStatus||"")){if(["canceled","incomplete_expired"].includes(sub.status))return;throw new AssistantError("This business already has a subscription.",409);}
 const item=sub.items.data[0],plan=assistantConfig().plans.find(p=>p.stripePriceId===item?.price.id);
 if(sub.items.data.length!==1||!plan||item.quantity!==1||item.price.currency!=="aud"||item.price.recurring?.interval!=="month"||item.price.recurring.interval_count!==1)throw new AssistantError("Subscription plan is not configured for this service.");
 const invoice=sub.latest_invoice&&typeof sub.latest_invoice!=="string"?sub.latest_invoice:null,paid=sub.status==="active"&&invoice?.status==="paid",paidThrough=paid?new Date(item.current_period_end*1000):null,ended=sub.ended_at?new Date(sub.ended_at*1000):new Date();
 await db.assistantWorkspace.updateMany({where:{id,OR:[{lastStripeSyncedAt:null},{lastStripeSyncedAt:{lte:started}}]},data:{stripeSubscriptionId:sub.id,stripeStatus:paid?"active":sub.status==="active"?"payment_pending":sub.status,planKey:plan.key,paidThrough,checkoutSessionId:null,checkoutAttemptId:null,checkoutAttemptAt:null,cancelAtPeriodEnd:sub.cancel_at_period_end,lastStripeSyncedAt:started,retentionAt:paid?null:workspace.retentionAt||retentionDeadline(ended),finalNoticeAt:paid?null:workspace.finalNoticeAt}});
}
export async function assistantCheckout(workspaceId:string,planKey:string){
 const stripe=getStripe(),config=assistantConfig();if(!stripe||!config.launchEnabled||!config.webhookSecret||!config.portalConfiguration)throw new AssistantError("Subscriptions are not available yet.",503);
 const plan=config.plans.find(p=>p.key===planKey&&p.available);if(!plan?.stripePriceId)throw new AssistantError("This plan is not available for purchase yet.",503);
 const workspace=await db.assistantWorkspace.findUniqueOrThrow({where:{id:workspaceId},include:{owner:{select:{email:true}}}});if(workspace.billingExempt)throw new AssistantError("This business is exempt from service fees.");
 if(workspace.stripeSubscriptionId&&!["canceled","incomplete_expired"].includes(workspace.stripeStatus||""))throw new AssistantError("Manage your existing subscription from billing.",409);
 const now=new Date();if(!(await db.assistantWorkspace.updateMany({where:{id:workspaceId,OR:[{checkoutLockUntil:null},{checkoutLockUntil:{lt:now}}]},data:{checkoutLockUntil:new Date(now.getTime()+60000)}})).count)throw new AssistantError("Your checkout is being prepared. Please wait a moment.",409);
 try{
  if(workspace.checkoutSessionId){const old=await stripe.checkout.sessions.retrieve(workspace.checkoutSessionId);if(old.status==="open"&&old.url)return old.url;if(old.status==="complete")throw new AssistantError("Your payment is being confirmed. Please refresh billing shortly.",409);if(old.status==="expired")await db.assistantWorkspace.update({where:{id:workspaceId},data:{checkoutSessionId:null,checkoutAttemptId:null,checkoutAttemptAt:null}});}
  const price=await stripe.prices.retrieve(plan.stripePriceId);if(!price.active||price.currency!=="aud"||price.unit_amount!==plan.priceCents||price.recurring?.interval!=="month"||price.recurring.interval_count!==1)throw new AssistantError("The plan price needs administrator review.",503);
  let customer=workspace.stripeCustomerId;if(!customer){const created=await stripe.customers.create({email:workspace.owner.email,name:workspace.name,metadata:{service:"assistants",workspaceId}},{idempotencyKey:`assistant-customer:${workspaceId}`});customer=created.id;await db.assistantWorkspace.update({where:{id:workspaceId},data:{stripeCustomerId:customer}});}
  // Save the attempt before contacting Stripe: retrying a lost response must
  // use an identical request and idempotency key, never risk another charge.
  const fresh=await db.assistantWorkspace.findUniqueOrThrow({where:{id:workspaceId}}),attemptId=fresh.checkoutAttemptId||randomUUID(),attemptAt=fresh.checkoutAttemptAt||new Date();
  if(!fresh.checkoutAttemptId)await db.assistantWorkspace.update({where:{id:workspaceId},data:{checkoutAttemptId:attemptId,checkoutAttemptAt:attemptAt}});
  if(attemptAt.getTime()+3600000<=Date.now())throw new AssistantError("This checkout attempt needs administrator review before retrying.",409);
  const checkout=await stripe.checkout.sessions.create({mode:"subscription",customer,line_items:[{price:price.id,quantity:1}],client_reference_id:workspaceId,metadata:{service:"assistants",workspaceId},subscription_data:{metadata:{service:"assistants",workspaceId}},success_url:assistantUrl(`/account?business=${workspaceId}&payment=success`),cancel_url:assistantUrl(`/account?business=${workspaceId}&payment=cancelled`),expires_at:Math.floor(attemptAt.getTime()/1000)+3600},{idempotencyKey:`assistant-checkout:${workspaceId}:${attemptId}`});
  if(!checkout.url)throw new AssistantError("Checkout could not be prepared.",503);await db.assistantWorkspace.update({where:{id:workspaceId},data:{checkoutSessionId:checkout.id}});return checkout.url;
 }finally{await db.assistantWorkspace.update({where:{id:workspaceId},data:{checkoutLockUntil:null}});}
}
export async function changeAssistantSubscription(workspaceId:string,cancel:boolean){const stripe=getStripe();if(!stripe)throw new AssistantError("Billing is unavailable.",503);const workspace=await db.assistantWorkspace.findUniqueOrThrow({where:{id:workspaceId}});if(!workspace.stripeSubscriptionId)throw new AssistantError("There is no active subscription to change.");const sub=await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId);if(sub.metadata.workspaceId!==workspaceId||sub.metadata.service!=="assistants"||stripeId(sub.customer)!==workspace.stripeCustomerId)throw new AssistantError("Subscription does not match this business.",403);if(sub.status==="canceled")throw new AssistantError("Choose a plan to reactivate this business.");await stripe.subscriptions.update(sub.id,{cancel_at_period_end:cancel});await syncAssistantSubscription(sub.id,stripe,workspaceId);}
export async function assistantBillingPortal(workspaceId:string){const stripe=getStripe(),config=assistantConfig(),workspace=await db.assistantWorkspace.findUniqueOrThrow({where:{id:workspaceId}});if(!stripe||!workspace.stripeCustomerId||!config.portalConfiguration)throw new AssistantError("Billing management has not been configured yet.",503);const portal=await stripe.billingPortal.configurations.retrieve(config.portalConfiguration);if(!portal.active||portal.features.subscription_update.enabled||!portal.features.invoice_history.enabled||!portal.features.payment_method_update.enabled||(portal.features.subscription_cancel.enabled&&portal.features.subscription_cancel.mode!=="at_period_end"))throw new AssistantError("The billing portal configuration needs administrator review.",503);return (await stripe.billingPortal.sessions.create({customer:workspace.stripeCustomerId,configuration:config.portalConfiguration,return_url:assistantUrl(`/account?business=${workspaceId}`)})).url;}
export async function handleAssistantStripeEvent(event:Stripe.Event,stripe:Stripe){let subscription:string|undefined;
 if(event.type.startsWith("customer.subscription.")){const sub=event.data.object as Stripe.Subscription;if(sub.metadata.service!=="assistants")return false;subscription=sub.id;}
 else if(event.type.startsWith("checkout.session.")){const session=event.data.object as Stripe.Checkout.Session;if(session.metadata?.service!=="assistants")return false;subscription=stripeId(session.subscription);}
 else if(event.type.startsWith("invoice.")){const invoice=event.data.object as Stripe.Invoice&{subscription?:string|Stripe.Subscription|null};subscription=stripeId(invoice.parent?.subscription_details?.subscription||invoice.subscription||null);if(!subscription||!await db.assistantWorkspace.findUnique({where:{stripeSubscriptionId:subscription},select:{id:true}}))return false;}
 else return false;if(subscription)await syncAssistantSubscription(subscription,stripe);return true;
}
