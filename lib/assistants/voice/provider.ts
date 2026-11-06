import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AssistantError } from "../http";
export const providerId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
export const voiceLanguages = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "pl",
  "ru",
  "uk",
  "ja",
  "ko",
  "zh",
  "ar",
  "hi",
  "id",
  "tr",
  "sv",
  "da",
  "fi",
  "no",
  "cs",
  "ro",
  "el",
  "hu",
  "sk",
  "bg",
  "hr",
  "ms",
  "ta",
  "fil",
  "vi",
] as const;
export function voiceReady() {
  return (
    process.env.AI_ASSISTANTS_VOICE_ENABLED === "true" &&
    Boolean(process.env.ELEVENLABS_API_KEY) &&
    Boolean(process.env.ELEVENLABS_WEBHOOK_SECRET)
  );
}
/** Fixed origin and no retries: a timed-out mutation may already have consumed credit. */
export async function eleven(path: string, method = "GET", data?: unknown) {
  if (!voiceReady())
    throw new AssistantError(
      "Voice needs administrator setup. You can prepare campaigns first.",
      503,
    );
  if (!/^\/(v1|v2)\/[a-zA-Z0-9_/-]+$/.test(path))
    throw new AssistantError("Invalid voice request.");
  const headers: Record<string, string> = {
    "xi-api-key": process.env.ELEVENLABS_API_KEY!,
  };
  const multipart = data instanceof FormData;
  if (data && !multipart) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`https://api.elevenlabs.io${path}`, {
      method,
      headers,
      body: multipart ? data : data ? JSON.stringify(data) : undefined,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new AssistantError(
      "The voice result is unconfirmed. Review the provider dashboard before retrying.",
      502,
    );
  }
  if (!response.ok)
    throw new AssistantError(
      `Voice provider rejected this action (${response.status}). Check provider permissions and credit.`,
      502,
    );
  if (response.status === 204) return {};
  const raw = await response.text();
  if (raw.length > 1_000_000)
    throw new AssistantError(
      "Voice provider response exceeded the limit.",
      502,
    );
  try {
    return JSON.parse(raw);
  } catch {
    throw new AssistantError("Voice provider response is unconfirmed.", 502);
  }
}
export async function availableVoices() {
  return z
    .object({
      voices: z
        .array(
          z.object({
            voice_id: providerId,
            name: z.string(),
            category: z.string().optional(),
          }),
        )
        .max(1000),
    })
    .parse(await eleven("/v1/voices")).voices;
}
export function validVoiceSignature(
  raw: string,
  header: string | null,
  secret = process.env.ELEVENLABS_WEBHOOK_SECRET || "",
  now = Date.now(),
) {
  if (!secret || !header) return false;
  const parts = header.split(",").map((v) => v.trim().split("=")),
    timestamp = parts.find(([k]) => k === "t")?.[1];
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex"),
  );
  return parts
    .filter(([k]) => k === "v0")
    .some(([, v]) =>
      Boolean(
        v &&
          /^[a-f0-9]{64}$/.test(v) &&
          timingSafeEqual(expected, Buffer.from(v)),
      ),
    );
}
