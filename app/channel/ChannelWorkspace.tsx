"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuArrowLeft,
  LuMessageCircle,
  LuSend,
  LuSettings,
  LuSquare,
} from "react-icons/lu";
import { useAccount } from "wagmi";

import { CHAT_PROVIDERS, type InferenceProvider } from "../chatConfig";
import { getAuthSession, getValhallaFile } from "../utils/requests";

const CHAT_HISTORY_MESSAGE_LIMIT = 23;
const CHAT_HISTORY_CHARACTER_LIMIT = 38_000;

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function getRecentChatMessages(messages: UIMessage[]) {
  const selectedMessages: UIMessage[] = [];
  let characterCount = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant" && message.role !== "user") continue;

    const text = messageText(message);
    if (!text) continue;
    if (
      selectedMessages.length >= CHAT_HISTORY_MESSAGE_LIMIT ||
      characterCount + text.length > CHAT_HISTORY_CHARACTER_LIMIT
    ) {
      break;
    }

    selectedMessages.unshift(message);
    characterCount += text.length;
  }

  while (selectedMessages.at(0)?.role === "assistant") {
    selectedMessages.shift();
  }

  return selectedMessages.map((message) => ({
    id: message.id,
    parts: [{ text: messageText(message), type: "text" }],
    role: message.role,
  }));
}

const CHAT_TRANSPORT = new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ body, messages }) => ({
    body: {
      ...(body ?? {}),
      messages: getRecentChatMessages(messages),
    },
  }),
});
const STARTER_QUESTIONS = [
  "Who appears to have worked on this raid, and what did each person contribute?",
  "By your assessment, was this raid successful overall? Cite the strongest evidence.",
  "What decisions, deliverables, and unresolved blockers are documented here?",
] as const;

type ActiveChatSettings = {
  apiKey: string;
  model: string;
  provider: InferenceProvider;
};

type MobileView = "archive" | "chat";

function channelLabel(key: string) {
  const pathParts = key.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] || key;
  return fileName.replace(/\.[^/.]+$/, "");
}

function getChatErrorPresentation(error: Error | undefined) {
  if (!error) return null;

  let serverMessage = "";
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string") serverMessage = parsed.error;
  } catch {
    serverMessage = error.message;
  }

  const normalizedMessage = serverMessage.toLowerCase();
  if (
    normalizedMessage.includes("authentication required") ||
    normalizedMessage.includes("wallet does not hold") ||
    normalizedMessage.includes("invalid request origin")
  ) {
    return {
      action: "archive" as const,
      message:
        "Your member session is no longer available. Return to the archive to sign in again.",
    };
  }

  if (
    normalizedMessage.includes("too large") ||
    normalizedMessage.includes("does not contain readable messages") ||
    normalizedMessage.includes("not part of the archived html collection")
  ) {
    return {
      action: "none" as const,
      message: serverMessage || "This channel cannot be queried.",
    };
  }

  if (
    normalizedMessage.includes("too many requests") ||
    normalizedMessage.includes("chat is busy")
  ) {
    return {
      action: "retry" as const,
      message:
        "Chat is temporarily busy or rate-limited. Wait a moment before trying again.",
    };
  }

  return {
    action: "retry" as const,
    message:
      "The answer could not be completed. Check your API key, model ID, provider access, and network connection.",
  };
}

function getValidCitationIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return new Set<string>();

  const value = (metadata as { validCitationIds?: unknown }).validCitationIds;
  if (!Array.isArray(value)) return new Set<string>();

  return new Set(value.filter((id): id is string => typeof id === "string"));
}

function CitedMessageText({
  message,
  text,
}: {
  message: UIMessage;
  text: string;
}) {
  const validCitationIds = getValidCitationIds(message.metadata);

  return text.split(/(\[M:\d+\])/g).map((part, index) => {
    const match = /^\[M:(\d+)\]$/.exec(part);
    if (!match) return part;

    const isValid = validCitationIds.has(match[1]);
    return (
      <span
        className={`chat-citation ${isValid ? "chat-citation--valid" : "chat-citation--invalid"}`}
        aria-label={`${part}, citation ${isValid ? "found" : "not found"} in this channel archive`}
        title={
          isValid
            ? "Citation found in this channel archive"
            : "Citation was not found in this channel archive"
        }
        key={`${part}-${index}`}
      >
        {part}
      </span>
    );
  });
}

export function ChannelWorkspace({ channelKey }: { channelKey: string }) {
  const { address, isConnecting } = useAccount();
  const [activeSettings, setActiveSettings] =
    useState<ActiveChatSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [input, setInput] = useState("");
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [model, setModel] = useState<string>(
    CHAT_PROVIDERS.openai.defaultModel,
  );
  const [provider, setProvider] = useState<InferenceProvider>("openai");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const providerSelectRef = useRef<HTMLSelectElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const shouldFocusSetupRef = useRef(false);
  const {
    clearError,
    error,
    messages,
    regenerate,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({ transport: CHAT_TRANSPORT });

  const {
    data: authSession,
    error: sessionError,
    isLoading: isSessionLoading,
  } = useQuery({
    queryKey: ["valhalla-session"],
    queryFn: getAuthSession,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const sessionAddress = authSession?.authenticated
    ? authSession.address
    : undefined;
  const hasVerifiedAccess = Boolean(
    address &&
    sessionAddress &&
    address.toLowerCase() === sessionAddress.toLowerCase(),
  );
  const validChannelKey =
    Boolean(channelKey) && channelKey.toLowerCase().endsWith(".html");
  const label = channelLabel(channelKey);

  const {
    data: channelUrl,
    error: channelError,
    isLoading: isChannelLoading,
    refetch: refetchChannel,
  } = useQuery({
    queryKey: ["valhalla-channel-view", sessionAddress, channelKey],
    queryFn: () => getValhallaFile(channelKey),
    enabled: hasVerifiedAccess && validChannelKey,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const selectedProvider = CHAT_PROVIDERS[provider];
  const providerLabel = activeSettings
    ? CHAT_PROVIDERS[activeSettings.provider].label
    : selectedProvider.label;
  const usesCustomModel = !(
    selectedProvider.models as readonly string[]
  ).includes(model);
  const chatIsBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const isAwaitingFirstResponseText =
    status === "submitted" ||
    (status === "streaming" &&
      (lastMessage?.role !== "assistant" || !messageText(lastMessage)));
  const errorPresentation = useMemo(
    () => getChatErrorPresentation(error),
    [error],
  );
  const chatHasTerminalError = errorPresentation?.action === "none";

  useEffect(() => {
    const messageViewport = chatMessagesRef.current;
    if (!messageViewport || !shouldAutoScrollRef.current) return;

    messageViewport.scrollTo({
      behavior: status === "streaming" ? "auto" : "smooth",
      top: messageViewport.scrollHeight,
    });
  }, [messages, status]);

  useEffect(() => {
    if (activeSettings || !shouldFocusSetupRef.current) return;
    shouldFocusSetupRef.current = false;
    providerSelectRef.current?.focus();
  }, [activeSettings]);

  useEffect(() => {
    if (isSessionLoading || hasVerifiedAccess) return;

    const resetChat = window.setTimeout(() => {
      setActiveSettings(null);
      setApiKey("");
      setConsentGiven(false);
      setMessages([]);
    }, 0);

    return () => window.clearTimeout(resetChat);
  }, [hasVerifiedAccess, isSessionLoading, setMessages]);

  const sendQuestion = (question: string) => {
    const trimmedQuestion = question.trim();
    if (
      !activeSettings ||
      !trimmedQuestion ||
      chatIsBusy ||
      chatHasTerminalError
    ) {
      return;
    }

    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    clearError();
    void sendMessage(
      { text: trimmedQuestion },
      {
        body: {
          apiKey: activeSettings.apiKey,
          channelKey,
          model: activeSettings.model,
          provider: activeSettings.provider,
        },
      },
    );
    setInput("");
  };

  const changeSettings = () => {
    if (
      messages.length > 0 &&
      !window.confirm(
        "Changing provider or model starts a new chat and clears this conversation. Continue?",
      )
    ) {
      return;
    }

    void stop();
    clearError();
    setMessages([]);
    shouldFocusSetupRef.current = true;
    setActiveSettings(null);
  };

  if (!validChannelKey) {
    return (
      <section className="channel-gate" aria-labelledby="channel-gate-title">
        <p className="eyebrow">Channel archive</p>
        <h1 id="channel-gate-title">Choose a channel first</h1>
        <p>Return to the archive and use the Ask action on an HTML channel.</p>
        <Link className="rg-button rg-button--primary" href="/">
          Back to archive
        </Link>
      </section>
    );
  }

  if (isSessionLoading || isConnecting) {
    return (
      <section className="channel-gate" aria-busy="true">
        <span className="loading-mark" aria-hidden="true" />
        <h1>Checking your member session</h1>
        <p>The channel workspace will open after access is confirmed.</p>
      </section>
    );
  }

  if (!hasVerifiedAccess) {
    return (
      <section className="channel-gate" aria-labelledby="channel-gate-title">
        <p className="eyebrow">Members’ archive</p>
        <h1 id="channel-gate-title">Return to the archive to sign in</h1>
        <p>
          {sessionError?.message ||
            "Connect the wallet associated with your retained member session before opening this channel."}
        </p>
        <Link className="rg-button rg-button--primary" href="/">
          Back to archive
        </Link>
      </section>
    );
  }

  return (
    <section className="channel-workspace" aria-labelledby="channel-title">
      <header className="channel-workspace-header">
        <div>
          <Link className="channel-back-link" href="/">
            <LuArrowLeft aria-hidden="true" />
            All channels
          </Link>
          <p className="eyebrow">Archived channel</p>
          <h1 id="channel-title" title={channelKey}>
            {label}
          </h1>
        </div>
      </header>

      <div
        className="channel-mobile-tabs"
        role="group"
        aria-label="Channel workspace"
      >
        <button
          type="button"
          aria-controls="channel-archive-panel"
          aria-pressed={mobileView === "archive"}
          onClick={() => setMobileView("archive")}
        >
          Archive
        </button>
        <button
          type="button"
          aria-controls="channel-chat-panel"
          aria-pressed={mobileView === "chat"}
          onClick={() => setMobileView("chat")}
        >
          Ask
        </button>
      </div>

      <div className="channel-workspace-grid" data-mobile-view={mobileView}>
        <section
          className="channel-archive-panel"
          id="channel-archive-panel"
          role="region"
          aria-label={`Archived channel ${label}`}
        >
          {isChannelLoading ? (
            <div className="channel-panel-state" aria-busy="true">
              <span className="loading-mark" aria-hidden="true" />
              <p>Loading the archived channel.</p>
            </div>
          ) : channelError ? (
            <div className="channel-panel-state" role="alert">
              <p>{channelError.message}</p>
              <button
                className="rg-button rg-button--secondary"
                type="button"
                onClick={() => void refetchChannel()}
              >
                Try again
              </button>
            </div>
          ) : channelUrl ? (
            <iframe
              className="channel-archive-frame"
              src={channelUrl}
              title={`Archived channel ${label}`}
              sandbox=""
              referrerPolicy="no-referrer"
            />
          ) : null}
        </section>

        <section
          className="channel-chat-panel"
          id="channel-chat-panel"
          role="region"
          aria-labelledby="channel-chat-title"
        >
          {!activeSettings ? (
            <form
              className="chat-setup"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmedKey = apiKey.trim();
                const trimmedModel = model.trim();
                if (!trimmedKey || !trimmedModel || !consentGiven) return;
                setActiveSettings({
                  apiKey: trimmedKey,
                  model: trimmedModel,
                  provider,
                });
              }}
            >
              <div className="chat-setup-heading">
                <div className="chat-setup-eyebrow">
                  <LuMessageCircle aria-hidden="true" />
                  <p className="eyebrow">Private, single-channel chat</p>
                </div>
                <h2 id="channel-chat-title">Bring your inference key</h2>
              </div>
              <p>
                Your key stays in this tab’s memory. Valhalla sends it only to
                its server for your selected provider requests and does not
                store the key or conversation. Each question sends this channel
                and up to your 12 most recent questions and answers to that
                provider.
              </p>

              <div className="chat-field-grid">
                <label className="chat-field">
                  <span>Provider</span>
                  <select
                    ref={providerSelectRef}
                    value={provider}
                    onChange={(event) => {
                      const nextProvider = event.target
                        .value as InferenceProvider;
                      setProvider(nextProvider);
                      setModel(CHAT_PROVIDERS[nextProvider].defaultModel);
                      setApiKey("");
                      setConsentGiven(false);
                    }}
                  >
                    {Object.entries(CHAT_PROVIDERS).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="chat-field">
                  <span>Model ID</span>
                  <select
                    value={usesCustomModel ? "__custom__" : model}
                    onChange={(event) =>
                      setModel(
                        event.target.value === "__custom__"
                          ? ""
                          : event.target.value,
                      )
                    }
                  >
                    {selectedProvider.models.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {modelId}
                      </option>
                    ))}
                    <option value="__custom__">Custom model ID…</option>
                  </select>
                  {usesCustomModel ? (
                    <input
                      type="text"
                      value={model}
                      maxLength={128}
                      placeholder="Enter a model ID"
                      spellCheck={false}
                      onChange={(event) => setModel(event.target.value)}
                    />
                  ) : null}
                  <small>
                    Choose a listed model or enter a custom model ID.
                  </small>
                </label>
              </div>

              <label className="chat-field">
                <span>{providerLabel} API key</span>
                <input
                  type="password"
                  value={apiKey}
                  maxLength={512}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>

              <label className="chat-consent">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(event) => setConsentGiven(event.target.checked)}
                />
                <span>
                  Send this channel and my questions to {providerLabel}. I
                  understand that provider’s data terms apply.
                </span>
              </label>

              <button
                className="rg-button rg-button--primary"
                type="submit"
                disabled={!apiKey.trim() || !model.trim() || !consentGiven}
              >
                Start private chat
              </button>
            </form>
          ) : (
            <div className="chat-session">
              <header className="chat-session-header">
                <div>
                  <p className="eyebrow">{providerLabel}</p>
                  <h2 id="channel-chat-title">Ask this channel</h2>
                  <p>{activeSettings.model}</p>
                </div>
                <button
                  className="chat-settings-button"
                  type="button"
                  onClick={changeSettings}
                >
                  <LuSettings aria-hidden="true" />
                  New chat settings
                </button>
              </header>

              <div
                className="chat-messages"
                ref={chatMessagesRef}
                role="log"
                aria-live="polite"
                onScroll={(event) => {
                  const viewport = event.currentTarget;
                  const isNearBottom =
                    viewport.scrollHeight -
                      viewport.scrollTop -
                      viewport.clientHeight <
                    80;
                  shouldAutoScrollRef.current = isNearBottom;
                  setShowJumpToLatest(!isNearBottom);
                }}
              >
                {messages.length === 0 ? (
                  <div className="chat-empty">
                    <p>
                      Ask about contributors, decisions, outcomes, blockers, or
                      the overall success of this channel.
                    </p>
                    <div className="chat-starters">
                      {STARTER_QUESTIONS.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => sendQuestion(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages
                    .filter(
                      (message) =>
                        message.role !== "assistant" || messageText(message),
                    )
                    .map((message) => (
                      <article
                        className={`chat-message chat-message--${message.role}`}
                        key={message.id}
                      >
                        <p className="chat-message-role">
                          {message.role === "user" ? "You" : "Valhalla guide"}
                        </p>
                        <div className="chat-message-content">
                          {message.parts.map((part, index) =>
                            part.type === "text" ? (
                              <span key={`${message.id}-${index}`}>
                                {message.role === "assistant" ? (
                                  <CitedMessageText
                                    message={message}
                                    text={part.text}
                                  />
                                ) : (
                                  part.text
                                )}
                              </span>
                            ) : null,
                          )}
                        </div>
                      </article>
                    ))
                )}
                {isAwaitingFirstResponseText ? (
                  <div
                    className="chat-thinking"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="chat-thinking-avatar" aria-hidden="true">
                      <LuMessageCircle />
                    </span>
                    <span className="chat-thinking-bubble">
                      <span>
                        {status === "submitted"
                          ? "Reading this channel"
                          : "Writing a concise answer"}
                      </span>
                      <span className="chat-thinking-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>

              {showJumpToLatest ? (
                <button
                  className="chat-jump-latest"
                  type="button"
                  onClick={() => {
                    shouldAutoScrollRef.current = true;
                    setShowJumpToLatest(false);
                    chatMessagesRef.current?.scrollTo({
                      behavior: "smooth",
                      top: chatMessagesRef.current.scrollHeight,
                    });
                  }}
                >
                  Jump to latest
                </button>
              ) : null}

              {errorPresentation ? (
                <div className="chat-error" role="alert">
                  <p>{errorPresentation.message}</p>
                  {errorPresentation.action === "retry" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!activeSettings) return;
                        clearError();
                        void regenerate({
                          body: {
                            apiKey: activeSettings.apiKey,
                            channelKey,
                            model: activeSettings.model,
                            provider: activeSettings.provider,
                          },
                        });
                      }}
                    >
                      Try again
                    </button>
                  ) : errorPresentation.action === "archive" ? (
                    <Link href="/">Return to archive</Link>
                  ) : errorPresentation.action === "none" ? (
                    <Link href="/">Choose another channel</Link>
                  ) : null}
                </div>
              ) : null}

              <form
                className="chat-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendQuestion(input);
                }}
              >
                <label className="visually-hidden" htmlFor="channel-question">
                  Ask a question about this channel
                </label>
                <textarea
                  id="channel-question"
                  value={input}
                  maxLength={4_000}
                  rows={3}
                  placeholder="Ask about this channel…"
                  disabled={chatIsBusy || chatHasTerminalError}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      sendQuestion(input);
                    }
                  }}
                />
                {chatIsBusy ? (
                  <button
                    className="chat-send-button"
                    type="button"
                    aria-label="Stop generating answer"
                    onClick={() => void stop()}
                  >
                    <LuSquare aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    className="chat-send-button"
                    type="submit"
                    disabled={!input.trim() || chatHasTerminalError}
                    aria-label="Send question"
                  >
                    <LuSend aria-hidden="true" />
                  </button>
                )}
              </form>
              <p className="chat-disclaimer">
                AI can misread context. Verify claims in the archive; a struck
                citation was not found in this channel.
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
