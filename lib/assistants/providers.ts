import { z } from "zod";
import type { AssistantModel } from "./config";
export type AssistantInput = {
  system: string;
  research?: boolean;
  messages: { role: "user" | "assistant"; content: string }[];
};
export interface AssistantProvider {
  reply(
    model: AssistantModel,
    input: AssistantInput,
  ): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    sources?: { url: string; title: string }[];
  }>;
}
const resultSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
      citations: z
        .array(
          z.object({
            type: z.string(),
            url: z.string().optional(),
            title: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
  stop_reason: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});
export function anthropicProvider(
  apiKey: string,
  request: typeof fetch = fetch,
): AssistantProvider {
  return {
    async reply(model, input) {
      try {
        const response = await request(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            redirect: "error",
            cache: "no-store",
            signal: AbortSignal.timeout(input.research ? 60000 : 30000),
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: model.modelId,
              max_tokens: model.maxOutputTokens,
              system: input.system,
              messages: input.messages,
              ...(input.research
                ? {
                    tools: [
                      {
                        type: "web_search_20250305",
                        name: "web_search",
                        max_uses: 2,
                      },
                    ],
                  }
                : {}),
            }),
          },
        );
        if (!response.ok) throw new Error();
        const data = resultSchema.parse(await response.json());
        const text = data.content
          .filter((b) => b.type === "text")
          .map((b) => b.text || "")
          .join("\n")
          .trim();
        if (!text || data.stop_reason !== "end_turn") throw new Error();
        const sources = input.research
          ? data.content.flatMap((b) =>
              (b.citations || [])
                .filter(
                  (c) =>
                    c.type === "web_search_result_location" &&
                    c.url?.startsWith("https://"),
                )
                .map((c) => ({ url: c.url!, title: c.title || c.url! })),
            )
          : undefined;
        return {
          text,
          sources,
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        };
      } catch {
        throw new Error(
          "The assistant could not answer. Please try again shortly.",
        );
      }
    },
  };
}
export function getAssistantProvider(
  model: AssistantModel,
  config: { anthropicApiKey?: string },
): AssistantProvider {
  if (model.provider === "anthropic" && config.anthropicApiKey)
    return anthropicProvider(config.anthropicApiKey);
  throw new Error("This model is not connected.");
}
