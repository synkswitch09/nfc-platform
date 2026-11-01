import { db } from "@/lib/db";
import { createOpaqueToken,sha256 } from "@/lib/crypto";
import { sendTransactionalEmail } from "@/lib/email";
import { assistantConfig,assistantUrl } from "./config";
export async function assistantAuthEmail(user:{id:string;email:string},purpose:"VERIFY"|"RESET"){const token=createOpaqueToken();await db.assistantAuthToken.create({data:{userId:user.id,purpose,tokenHash:sha256(token),expiresAt:new Date(Date.now()+(purpose==="VERIFY"?24:1)*3600000)}});const path=purpose==="VERIFY"?"/verify-email":"/reset-password";await sendTransactionalEmail({storeSlug:assistantConfig().emailStore,to:user.email,subject:purpose==="VERIFY"?"Verify your assistant account":"Reset your assistant password",text:`${purpose==="VERIFY"?"Verify your email to set up your assistant":"Choose a new password for your account"}:\n${assistantUrl(`${path}?token=${token}`)}\n\nIf you did not request this, you can ignore this email.`});}
