import { isInferenceProvider, type InferenceProvider } from "../../chatConfig";

const API_KEY_MAX_LENGTH = 512;
const CHANNEL_KEY_MAX_LENGTH = 1_024;
const CHAT_HISTORY_MAX_CHARACTERS = 40_000;
const CHAT_MESSAGE_MAX_CHARACTERS = 6_000;
const CHAT_MESSAGE_MAX_COUNT = 24;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

type ChatHistoryMessage = {
  role: "assistant" | "user";
  text: string;
};

export type ChannelChatRequest = {
  apiKey: string;
  channelKey: string;
  messages: ChatHistoryMessage[];
  model: string;
  provider: InferenceProvider;
};

function parseMessages(value: unknown): ChatHistoryMessage[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > CHAT_MESSAGE_MAX_COUNT
  ) {
    return null;
  }

  const messages: ChatHistoryMessage[] = [];
  let totalCharacters = 0;

  for (const item of value) {
    if (!item || typeof item !== "object") return null;

    const candidate = item as {
      parts?: unknown;
      role?: unknown;
    };
    if (candidate.role !== "assistant" && candidate.role !== "user") {
      return null;
    }
    if (!Array.isArray(candidate.parts) || candidate.parts.length === 0) {
      return null;
    }

    const textParts: string[] = [];
    for (const part of candidate.parts) {
      if (!part || typeof part !== "object") return null;
      const typedPart = part as { text?: unknown; type?: unknown };

      if (typedPart.type === "step-start") continue;
      if (typedPart.type !== "text" || typeof typedPart.text !== "string") {
        return null;
      }
      textParts.push(typedPart.text);
    }

    const text = textParts.join("\n").trim();
    if (!text || text.length > CHAT_MESSAGE_MAX_CHARACTERS) return null;

    totalCharacters += text.length;
    if (totalCharacters > CHAT_HISTORY_MAX_CHARACTERS) return null;

    messages.push({ role: candidate.role, text });
  }

  return messages.at(-1)?.role === "user" ? messages : null;
}

export function parseChannelChatRequest(
  value: unknown,
): ChannelChatRequest | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    apiKey?: unknown;
    channelKey?: unknown;
    messages?: unknown;
    model?: unknown;
    provider?: unknown;
  };
  const apiKey =
    typeof candidate.apiKey === "string" ? candidate.apiKey.trim() : "";
  const channelKey =
    typeof candidate.channelKey === "string" ? candidate.channelKey.trim() : "";
  const model =
    typeof candidate.model === "string" ? candidate.model.trim() : "";
  const messages = parseMessages(candidate.messages);

  if (
    !isInferenceProvider(candidate.provider) ||
    apiKey.length < 8 ||
    apiKey.length > API_KEY_MAX_LENGTH ||
    /[\r\n]/.test(apiKey) ||
    !channelKey ||
    channelKey.length > CHANNEL_KEY_MAX_LENGTH ||
    channelKey.includes("\0") ||
    !channelKey.toLowerCase().endsWith(".html") ||
    !MODEL_ID_PATTERN.test(model) ||
    !messages
  ) {
    return null;
  }

  return {
    apiKey,
    channelKey,
    messages,
    model,
    provider: candidate.provider,
  };
}
