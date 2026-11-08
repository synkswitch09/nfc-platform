import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword,verifyPassword,sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { assistantConfig } from "@/lib/assistants/config";
import { assistantWrite,AssistantError,assistantError } from "@/lib/assistants/http";
import { assistantUser,createAssistantSession,destroyAssistantSession } from "@/lib/assistants/auth";
import { assistantAuthEmail } from "@/lib/assistants/email";
const credentials=z.object({action:z.enum(["login","register"]),email:z.string().trim().toLowerCase().email(),password:z.string().min(1).max(128),name:z.string().trim().min(1).max(100).optional(),businessName:z.string().trim().min(1).max(100).optional()}).strict();
export async function POST(request:NextRequest){try{
 assistantWrite(request);if(!(await rateLimit("assistant-auth",getClientIp(request),15,15*60000)).allowed)throw new AssistantError("Too many attempts. Please try again later.",429);const body=await request.json();
 if(body.action==="logout"){await destroyAssistantSession();return NextResponse.json({ok:true});}
 if(body.action==="resend"){const user=await assistantUser();if(user&&!user.emailVerifiedAt)await assistantAuthEmail(user,"VERIFY");return NextResponse.json({ok:true});}
 if(body.action==="forgot"){const {email}=z.object({action:z.literal("forgot"),email:z.string().trim().toLowerCase().email()}).strict().parse(body);const user=await db.user.findUnique({where:{email}});if(user?.status==="ACTIVE")await assistantAuthEmail(user,"RESET");return NextResponse.json({ok:true});}
 if(body.action==="verify"||body.action==="reset"){
  const data=z.object({action:z.enum(["verify","reset"]),token:z.string().min(30).max(200),password:z.string().min(12).max(128).optional()}).strict().parse(body);if(data.action==="reset"&&!data.password)throw new AssistantError("Enter your new password.");const hash=data.password?await hashPassword(data.password):null;
  await db.$transaction(async tx=>{const token=await tx.assistantAuthToken.findUnique({where:{tokenHash:sha256(data.token)}});if(!token||token.expiresAt<=new Date()||token.purpose!==(data.action==="verify"?"VERIFY":"RESET"))throw new AssistantError("This link has expired or was already used.");if(!(await tx.assistantAuthToken.deleteMany({where:{id:token.id}})).count)throw new AssistantError("This link has already been used.");await tx.user.update({where:{id:token.userId},data:data.action==="verify"?{emailVerifiedAt:new Date()}:{passwordHash:hash!}});if(data.action==="reset"){await tx.assistantSession.deleteMany({where:{userId:token.userId}});await tx.session.deleteMany({where:{userId:token.userId}});}});return NextResponse.json({ok:true});
 }
 const data=credentials.parse(body);const existing=await db.user.findUnique({where:{email:data.email}});
 if(data.action==="login"){if(!existing||existing.status!=="ACTIVE"||!existing.passwordHash||!await verifyPassword(data.password,existing.passwordHash))throw new AssistantError("Invalid email or password.",401);await createAssistantSession(existing.id);return NextResponse.json({ok:true,verified:Boolean(existing.emailVerifiedAt)});}
 if(!assistantConfig().launchEnabled)throw new AssistantError("Registration is not open yet. Please check back soon.",503);if(!data.name||!data.businessName)throw new AssistantError("Enter your name and business name.");if(data.password.length<12)throw new AssistantError("Use at least 12 characters for your password.");if(existing)throw new AssistantError("An account already uses this email. Please sign in or reset your password.",409);
 const passwordHash=await hashPassword(data.password);const user=await db.$transaction(async tx=>{const user=await tx.user.create({data:{email:data.email,name:data.name!,passwordHash}});await tx.assistantWorkspace.create({data:{ownerId:user.id,name:data.businessName!}});return user;});await createAssistantSession(user.id);await assistantAuthEmail(user,"VERIFY");return NextResponse.json({ok:true,verified:false});
 }catch(error){return assistantError(error);}}

// Only the signed-in user can read their own identity. Model configuration is admin-only.
export async function GET() {
  const user = await assistantUser();
  if (!user || !user.emailVerifiedAt) return NextResponse.json({ error: "Please sign in with a verified account." }, { status: 401 });
  const config = assistantConfig();
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role },
    ...(user.role === "ADMIN" ? { models: config.models.map(m => ({ name: m.name, modelId: m.modelId, enabled: m.enabled })),
      anthropicConfigured: Boolean(config.anthropicApiKey) } : {}) }, { headers: { "Cache-Control": "private, no-store" } });
}
