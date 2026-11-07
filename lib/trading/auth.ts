import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { assistantUser } from "@/lib/assistants/auth";
import { isAssistantHost } from "@/lib/assistants/config";
import { canAccessTrading, tradingConfig } from "./config";
export async function tradingActor() {
  const user = isAssistantHost((await headers()).get("host")) ? await assistantUser() : await getCurrentUser();
  return canAccessTrading(user, tradingConfig().ownerId) ? user : null;
}
