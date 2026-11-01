import { cache } from "react";
import { cookies,headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createOpaqueToken,sha256 } from "@/lib/crypto";
import { assistantConfig,isAssistantHost } from "./config";
export const ASSISTANT_COOKIE="assistant_session";
export async function createAssistantSession(userId:string){const config=assistantConfig(),token=createOpaqueToken(),expiresAt=new Date(Date.now()+30*86400000);await db.assistantSession.create({data:{userId,tokenHash:sha256(token),origin:config.origin,expiresAt}});(await cookies()).set(ASSISTANT_COOKIE,token,{httpOnly:true,secure:config.origin.startsWith("https:"),sameSite:"lax",path:"/",expires:expiresAt});}
export const assistantUser=cache(async()=>{if(!isAssistantHost((await headers()).get("host")))return null;const token=(await cookies()).get(ASSISTANT_COOKIE)?.value;if(!token)return null;const session=await db.assistantSession.findUnique({where:{tokenHash:sha256(token)},include:{user:{select:{id:true,email:true,name:true,role:true,status:true,emailVerifiedAt:true}}}});if(!session||session.expiresAt<=new Date()||session.origin!==assistantConfig().origin||session.user.status!=="ACTIVE")return null;return session.user;});
export async function requireAssistantUser(){const user=await assistantUser();if(!user)redirect("/login");if(!user.emailVerifiedAt)redirect("/verify-email");return user;}
export async function destroyAssistantSession(){const jar=await cookies();const token=jar.get(ASSISTANT_COOKIE)?.value;if(token)await db.assistantSession.deleteMany({where:{tokenHash:sha256(token)}});jar.set(ASSISTANT_COOKIE,"",{httpOnly:true,sameSite:"lax",path:"/",expires:new Date(0)});}
