// Integration checks only against the disposable CI database. All external
// provider calls are simulated; this script cannot send real Meta messages.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { sealMeta } from "../lib/assistants/meta/security";
import { processMetaQueue,receiveMetaEvents,sendSocialManualReply } from "../lib/assistants/meta/queue";
import { revokeMetaUser } from "../lib/assistants/meta/revoke";
async function main(){
 const url=new URL(process.env.DATABASE_URL||"");if(process.env.CI!=="true"||process.env.APP_ENV!=="development"||url.hostname!=="localhost"||url.pathname!=="/nfc_platform")throw new Error("Only the disposable CI database is allowed");
 Object.assign(process.env,{AI_ASSISTANTS_ENABLED:"true",ANTHROPIC_API_KEY:"ci-not-real",AI_ASSISTANTS_META_ENABLED:"true",AI_ASSISTANTS_META_APP_ID:"123456",AI_ASSISTANTS_META_APP_SECRET:"ci-app-secret-not-real",AI_ASSISTANTS_META_VERIFY_TOKEN:"ci-verify-token-with-at-least-32-characters",AI_ASSISTANTS_META_TOKEN_KEY:"ci-encryption-secret-with-at-least-32-characters"});
 const realFetch=globalThis.fetch;let ownerId="",workspaceId="",secondId="",mode="ok",modelCalls=0,sends=0;let modelStarted:()=>void=()=>{},releaseModel:()=>void=()=>{};
 globalThis.fetch=async(input,init)=>{const target=new URL(String(input));if(target.hostname==="api.anthropic.com"){modelCalls++;if(mode==="handoff"){modelStarted();await new Promise<void>(resolve=>{releaseModel=resolve;});}return Response.json({content:[{type:"text",text:"Hello from the approved business FAQ."}],stop_reason:"end_turn",usage:{input_tokens:100,output_tokens:20}});}if(target.hostname==="graph.facebook.com"){assert.equal(init?.method,"POST");sends++;if(mode==="timeout")throw Error("Simulated lost response after possible delivery");return Response.json({message_id:`ci-sent-${sends}`});}throw Error("Unexpected external request");};
 try{
  const user=await db.user.create({data:{email:`meta-ci-${randomUUID()}@example.test`,name:"Meta CI",emailVerifiedAt:new Date()}});ownerId=user.id;
  const createWorkspace=(name:string)=>db.assistantWorkspace.create({data:{ownerId,name,billingExempt:true,billingExemptReason:"Disposable CI fixture",channels:["INSTAGRAM"],publishedKnowledge:`${name} FAQ`,knowledgeApprovedAt:new Date()}});
  const a=await createWorkspace("Business A"),b=await createWorkspace("Business B");workspaceId=a.id;secondId=b.id;
  const connectionId=randomUUID(),otherId=randomUUID();const createConnection=(id:string,workspaceId:string,accountId:string)=>db.assistantSocialConnection.create({data:{id,workspaceId,provider:"INSTAGRAM",accountId,pageId:accountId,displayName:`CI ${accountId}`,authorizingUserId:"1001",tokenCiphertext:sealMeta("not-a-real-token",`connection:${id}`),autoMessages:true}});
  await createConnection(connectionId,a.id,"10001");await createConnection(otherId,b.id,"10002");
  const incoming=(mid:string,account="10001",contact="20001",message:object={text:"Which colours?"})=>({object:"instagram",entry:[{id:account,time:Math.floor(Date.now()/1000),messaging:[{sender:{id:contact},recipient:{id:account},timestamp:Date.now(),message:{mid,...message}}]}]});
  await Promise.all([receiveMetaEvents(incoming("dedup")),receiveMetaEvents(incoming("dedup"))]);assert.equal(await db.assistantSocialEvent.count({where:{connectionId}}),1);
  await Promise.all([processMetaQueue(1),processMetaQueue(1)]);assert.equal(sends,1);assert.equal(modelCalls,1);assert.equal(await db.assistantMessage.count({where:{conversation:{workspaceId:a.id}}}),2);
  assert.equal(await db.assistantMessage.count({where:{conversation:{workspaceId:b.id}}}),0);
  const firstConversation=await db.assistantConversation.findFirstOrThrow({where:{workspaceId:a.id}}),requestId=randomUUID();await sendSocialManualReply(a.id,firstConversation.id,"A person is helping now.",requestId);await sendSocialManualReply(a.id,firstConversation.id,"A person is helping now.",requestId);assert.equal(sends,2,"duplicate manual request must send once");await assert.rejects(()=>sendSocialManualReply(b.id,firstConversation.id,"Wrong business",randomUUID()));
  // External manual Meta replies pause AI, while echoes of our own sends do not.
  await db.assistantConversation.update({where:{id:firstConversation.id},data:{humanOnly:false}});await receiveMetaEvents({object:"instagram",entry:[{id:"10001",messaging:[{sender:{id:"10001"},recipient:{id:"20001"},timestamp:Date.now(),message:{mid:"ci-sent-1",text:"Our sent reply",is_echo:true}}]}]});await processMetaQueue();assert.equal((await db.assistantConversation.findUniqueOrThrow({where:{id:firstConversation.id}})).humanOnly,false);
  await receiveMetaEvents({object:"instagram",entry:[{id:"10001",messaging:[{sender:{id:"10001"},recipient:{id:"20001"},timestamp:Date.now(),message:{mid:"external-human",text:"A human replied in Meta",is_echo:true}}]}]});await processMetaQueue();assert.equal((await db.assistantConversation.findUniqueOrThrow({where:{id:firstConversation.id}})).humanOnly,true);
  // A human takeover committed during model generation must suppress delivery.
  mode="handoff";await receiveMetaEvents(incoming("handoff","10001","20002"));const started=new Promise<void>(resolve=>{modelStarted=resolve;});const processing=processMetaQueue(1);await Promise.race([started,new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error("Model generation did not start")),15000);timer.unref();})]);const handoff=await db.assistantConversation.findFirstOrThrow({where:{socialConnectionId:connectionId,externalThreadId:"dm:20002"}});await db.assistantConversation.update({where:{id:handoff.id},data:{humanOnly:true}});releaseModel();await processing;assert.equal(sends,2);assert.equal((await db.assistantSocialEvent.findUniqueOrThrow({where:{connectionId_eventKey:{connectionId,eventKey:"message:handoff"}}})).status,"SKIPPED");
  mode="timeout";await receiveMetaEvents(incoming("uncertain","10001","20003"));await processMetaQueue(1);const attempted=sends,generated=modelCalls;const uncertain=await db.assistantSocialEvent.findUniqueOrThrow({where:{connectionId_eventKey:{connectionId,eventKey:"message:uncertain"}}});assert.equal(uncertain.status,"UNCERTAIN");await processMetaQueue();assert.equal(sends,attempted);assert.equal(modelCalls,generated,"uncertain sends must not generate again");
  mode="ok";await receiveMetaEvents(incoming("old","10001","20004"));await db.assistantSocialEvent.updateMany({where:{eventKey:"message:old"},data:{occurredAt:new Date(Date.now()-25*3600000)}});await processMetaQueue();assert.equal(sends,attempted);
  await receiveMetaEvents(incoming("photo","10001","20005",{attachments:[{type:"image"}]}));await processMetaQueue();assert.equal(sends,attempted);assert.equal((await db.assistantConversation.findFirstOrThrow({where:{socialConnectionId:connectionId,externalThreadId:"dm:20005"}})).humanOnly,true);
  await receiveMetaEvents(incoming("refund","10001","20006",{text:"I need a refund"}));await processMetaQueue();assert.equal(sends,attempted);
  // A confirmed outbound comment must never be answered again, even when
  // Meta supplies a differently-scoped actor ID.
  await db.assistantSocialConnection.update({where:{id:connectionId},data:{autoComments:true}});
  await db.assistantSocialEvent.create({data:{connectionId,eventKey:"sent-comment",kind:"COMMENT",contactId:"20009",targetId:"99900",text:"Original",occurredAt:new Date(),status:"SENT",externalReplyId:"99901"}});
  await receiveMetaEvents({object:"instagram",entry:[{id:"10001",time:Math.floor(Date.now()/1000),changes:[{field:"comments",value:{id:"99901",from:{id:"88888"},text:"Our own reply"}}]}]});await processMetaQueue();assert.equal(sends,attempted);assert.equal(modelCalls,generated);
  // The quota is shared across web/social and enforced atomically by the existing service.
  const period=new Date().toISOString().slice(0,7);await db.assistantUsage.updateMany({where:{workspaceId:a.id,period},data:{responses:10000}});await receiveMetaEvents(incoming("quota","10001","20007"));await processMetaQueue();assert.equal(modelCalls,generated);assert.equal(sends,attempted);
  // Durable SENDING fences cannot be replayed after a worker crash.
  await receiveMetaEvents(incoming("crashed","10001","20008"));await db.assistantSocialEvent.updateMany({where:{eventKey:"message:crashed"},data:{status:"SENDING",leaseUntil:new Date(0)}});await processMetaQueue();assert.equal((await db.assistantSocialEvent.findUniqueOrThrow({where:{connectionId_eventKey:{connectionId,eventKey:"message:crashed"}}})).status,"UNCERTAIN");assert.equal(sends,attempted);
  // One active account per provider, but disconnected history can be retained
  // safely when the business chooses another account later.
  await assert.rejects(()=>createConnection(randomUUID(),a.id,"10003"));
  await db.assistantSocialConnection.update({where:{id:connectionId},data:{status:"DISCONNECTED",tokenCiphertext:null,autoMessages:false,autoComments:false}});
  await createConnection(randomUUID(),a.id,"10003");
  await assert.rejects(()=>sendSocialManualReply(a.id,firstConversation.id,"Must not reach a different account",randomUUID()));assert.equal(sends,attempted);
  // Revocation/deletion is restricted to Meta-derived records, not global users or web chat.
  const web=await db.assistantConversation.create({data:{workspaceId:a.id,tokenHash:randomUUID(),channel:"WEB"}});await revokeMetaUser("1001");assert.equal(await db.assistantSocialConnection.count({where:{workspaceId:{in:[a.id,b.id]}}}),0);assert.equal(await db.assistantSocialEvent.count({where:{connectionId}}),0);assert.ok(await db.assistantConversation.findUnique({where:{id:web.id}}));assert.equal((await db.assistantWorkspace.findUniqueOrThrow({where:{id:a.id}})).publishedKnowledge,"Business A FAQ");assert.ok(await db.user.findUnique({where:{id:ownerId}}));
  console.log("Meta integration: tenant isolation, webhook deduplication, concurrent claims, manual idempotency, echoes, human takeover, uncertain delivery, reply window, media, complaints, quota, crash recovery and scoped deletion passed.");
 }finally{globalThis.fetch=realFetch;if(workspaceId||secondId)await db.assistantWorkspace.deleteMany({where:{id:{in:[workspaceId,secondId].filter(Boolean)}}});if(ownerId)await db.user.delete({where:{id:ownerId}});await db.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
