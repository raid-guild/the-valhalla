export const CHAT_PROVIDERS = {
  anthropic: {
    defaultModel: "claude-sonnet-4-6",
    label: "Anthropic",
    models: ["claude-sonnet-4-6", "claude-haiku-4-5"],
  },
  google: {
    defaultModel: "gemini-2.5-flash",
    label: "Google",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  openai: {
    defaultModel: "gpt-5.6-luna",
    label: "OpenAI",
    models: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5-mini"],
  },
} as const;

export type InferenceProvider = keyof typeof CHAT_PROVIDERS;

export function isInferenceProvider(
  value: unknown,
): value is InferenceProvider {
  return typeof value === "string" && value in CHAT_PROVIDERS;
}
