import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/http";
import { db } from "@/lib/db";
import { assistantUser } from "./auth";
import { isAssistantHost } from "./config";
import { canEditAssistant } from "./policy";
export class AssistantError extends Error{constructor(message:string,readonly status=400){super(message);}}
export function assistantWrite(request:NextRequest){if(!isAssistantHost(request.headers.get("host"))||!assertSameOrigin(request))throw new AssistantError("Invalid request origin",403);}
export async function assistantActor(){const user=await assistantUser();if(!user||!user.emailVerifiedAt)throw new AssistantError("Please sign in with a verified account.",401);return user;}
export async function ownedWorkspace(id:string){const user=await assistantActor();if(!z.uuid().safeParse(id).success)throw new AssistantError("Assistant not found",404);const workspace=await db.assistantWorkspace.findUnique({where:{id}});if(!workspace||!canEditAssistant(user,workspace))throw new AssistantError("Assistant not found",404);return {user,workspace};}
export function assistantError(error:unknown){if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return NextResponse.json({error:"An account or business with these details already exists. Check the email and business name."},{status:409});if(error instanceof AssistantError)return NextResponse.json({error:error.message},{status:error.status});if(error instanceof z.ZodError)return NextResponse.json({error:error.issues.map(i=>`${i.path.join(".")||"Settings"}: ${i.message}`).join("\n"),issues:error.issues.map(i=>({path:i.path.join("."),message:i.message}))},{status:400});return NextResponse.json({error:"We could not complete that action. Please try again."},{status:500});}
