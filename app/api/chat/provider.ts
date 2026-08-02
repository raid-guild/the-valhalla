import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import type { InferenceProvider } from "../../chatConfig";

export function createChatLanguageModel(
  provider: InferenceProvider,
  model: string,
  apiKey: string,
) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogle({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
  }
}
