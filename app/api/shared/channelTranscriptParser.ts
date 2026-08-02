import { load } from "cheerio";

export const MAX_CHANNEL_TRANSCRIPT_CHARACTERS = 320_000;

export type ChannelTranscriptMessage = {
  author: string;
  content: string;
  id: string;
  timestamp?: string;
};

export type ChannelTranscript = {
  characterCount: number;
  messages: ChannelTranscriptMessage[];
  text: string;
};

export class ChannelTranscriptTooLargeError extends Error {
  constructor() {
    super("This channel is too large for single-channel chat.");
    this.name = "ChannelTranscriptTooLargeError";
  }
}

function normalizeInlineText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeMessageText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(normalizeInlineText)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function findTimestamp(candidates: Array<string | undefined>) {
  return candidates.find(
    (candidate) =>
      candidate &&
      candidate.length <= 160 &&
      Number.isFinite(Date.parse(candidate)),
  );
}

export function parseChannelTranscript(html: string): ChannelTranscript {
  const $ = load(html);
  const messages: ChannelTranscriptMessage[] = [];
  let lastAuthor = "Unknown participant";
  let characterCount = 0;

  $("[data-message-id]").each((index, element) => {
    const message = $(element);
    const authorText = normalizeInlineText(
      message.find("[data-user-id]").first().text(),
    );

    if (authorText) lastAuthor = authorText;

    const contentElement = message.find(".chatlog__content").first().clone();
    contentElement.find("br").replaceWith("\n");
    contentElement.find("img[alt]").each((_, image) => {
      const alt = normalizeInlineText($(image).attr("alt") ?? "");
      $(image).replaceWith(alt ? ` ${alt} ` : "");
    });

    const content = normalizeMessageText(contentElement.text());
    if (!content) return;

    const rawId = message.attr("data-message-id") ?? "";
    const id = /^\d{1,128}$/.test(rawId) ? rawId : `x${index + 1}`;
    const timestampElement = message
      .find(".chatlog__timestamp, .chatlog__short-timestamp")
      .first();
    const timestamp = findTimestamp([
      timestampElement.attr("title"),
      timestampElement.attr("data-timestamp"),
      normalizeInlineText(timestampElement.text()),
    ]);
    const label = [
      `M:${id}`,
      timestamp ? `time:${timestamp}` : undefined,
      `author:${lastAuthor}`,
    ]
      .filter(Boolean)
      .join(" | ");
    const transcriptLine = `[${label}] ${content}`;

    characterCount += transcriptLine.length + 1;
    if (characterCount > MAX_CHANNEL_TRANSCRIPT_CHARACTERS) {
      throw new ChannelTranscriptTooLargeError();
    }

    messages.push({
      author: lastAuthor,
      content,
      id,
      timestamp,
    });
  });

  return {
    characterCount,
    messages,
    text: messages
      .map((message) => {
        const label = [
          `M:${message.id}`,
          message.timestamp ? `time:${message.timestamp}` : undefined,
          `author:${message.author}`,
        ]
          .filter(Boolean)
          .join(" | ");
        return `[${label}] ${message.content}`;
      })
      .join("\n"),
  };
}
