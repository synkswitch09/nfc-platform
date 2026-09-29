type LogValue = string | number | boolean | null | undefined;

export function logEvent(level: "info" | "warn" | "error", event: string, fields: Record<string, LogValue> = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, environment: currentAppEnvironment(), event, ...fields });
  if (level === "error") console.error(entry); else if (level === "warn") console.warn(entry); else console.info(entry);
}
import { currentAppEnvironment } from "@/lib/config";
