import { db } from "@/lib/db";
// Meta calls this with an app-scoped authorizing user ID, never a Page ID.
// Delete only Meta-derived data, preserving business knowledge, subscriptions,
// website conversations, shared customer logins and commerce orders.
export async function revokeMetaUser(userId:string){
 const connections=await db.assistantSocialConnection.findMany({where:{authorizingUserId:userId},select:{workspaceId:true}}),workspaces=[...new Set(connections.map(c=>c.workspaceId))].sort();
 for(const workspaceId of workspaces)await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AssistantWorkspace" WHERE id=${workspaceId}::uuid FOR UPDATE`;
  const removing=await tx.assistantSocialConnection.findMany({where:{workspaceId,authorizingUserId:userId},select:{provider:true}});
  await tx.assistantSocialConnection.deleteMany({where:{workspaceId,authorizingUserId:userId}});
  await tx.assistantMetaFlow.deleteMany({where:{workspaceId}});
  const workspace=await tx.assistantWorkspace.findUnique({where:{id:workspaceId}});if(workspace)await tx.assistantWorkspace.update({where:{id:workspaceId},data:{channels:workspace.channels.filter(c=>!removing.some(r=>r.provider===c))}});
 });
}
