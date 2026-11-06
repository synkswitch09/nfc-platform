import { createHmac } from "node:crypto";
import { AssistantError } from "../http";
import { requireMeta } from "../meta/security";
export function telegramSecret(id: string) {
  return createHmac("sha256", requireMeta().tokenKey)
    .update(`telegram:${id}`)
    .digest("hex");
}
export async function telegram(
  token: string,
  method: string,
  body: Record<string, unknown> = {},
) {
  if (
    !/^\d{5,20}:[A-Za-z0-9_-]{20,120}$/.test(token) ||
    ![
      "getMe",
      "getWebhookInfo",
      "setWebhook",
      "deleteWebhook",
      "sendMessage",
    ].includes(method)
  )
    throw new AssistantError("Invalid Telegram bot token or operation.");
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AssistantError(
      "Telegram did not confirm this action. Check the bot before retrying.",
      502,
    );
  }
  const data = await response.json();
  if (!response.ok || data.ok !== true)
    throw new AssistantError(
      "Telegram rejected this action. Check the bot token and permissions.",
      502,
    );
  return data.result;
}
