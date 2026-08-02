"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { LuExternalLink, LuFileText, LuSearch, LuX } from "react-icons/lu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import type { Address } from "viem";
import { gnosis } from "viem/chains";

import {
  WALLET_CONNECT_REQUESTED_EVENT,
  WalletControl,
} from "./shared/WalletControl";
import { fuzzyScore } from "./utils/fuzzy";
import {
  createAuthMessage,
  getAuthSession,
  getValhallaFile,
  getValhallaFiles,
  logoutAuthSession,
  verifyAuthMessage,
  ApiRequestError,
  type AuthSession,
  type ValhallaFile,
} from "./utils/requests";

const AUTH_SESSION_QUERY_KEY = ["valhalla-session"] as const;

type AuthPhase = "idle" | "preparing" | "awaiting-signature" | "verifying";
type AccessState =
  | "archive"
  | "archive-error"
  | "archive-loading"
  | "check-in"
  | "idle"
  | "loading"
  | "logout-error"
  | "network-error"
  | "session-error"
  | "signing-out";

type AccessStateInput = {
  address?: Address;
  chainId?: number;
  filesError: unknown;
  hasVerifiedAccess: boolean;
  isConnecting: boolean;
  isEndingSession: boolean;
  isFilesLoading: boolean;
  isSessionLoading: boolean;
  logoutError: string;
  sessionError: unknown;
};

function resolveAccessState(input: AccessStateInput): AccessState {
  if (input.hasVerifiedAccess) {
    if (input.isFilesLoading) return "archive-loading";
    return input.filesError ? "archive-error" : "archive";
  }
  if (input.isEndingSession) return "signing-out";
  if (input.logoutError) return "logout-error";
  if (input.isSessionLoading || input.isConnecting) return "loading";
  if (input.sessionError) return "session-error";
  if (!input.address) return "idle";
  if (input.chainId !== gnosis.id) return "network-error";
  return "check-in";
}

function checkInAnnouncement(authPhase: AuthPhase) {
  switch (authPhase) {
    case "awaiting-signature":
      return "Check your wallet to sign the Valhalla sign-in message.";
    case "verifying":
      return "Verifying your RaidGuild membership.";
    case "preparing":
      return "Preparing your Valhalla sign-in message.";
    default:
      return "Sign a message to verify your membership and start a session.";
  }
}

type StatusAnnouncementContext = {
  authPhase: AuthPhase;
  isConnecting: boolean;
  visibleFilesCount: number;
};

const STATUS_ANNOUNCEMENTS: Record<
  AccessState,
  (context: StatusAnnouncementContext) => string
> = {
  "archive-error": () => "The archive did not open. Try again.",
  "archive-loading": () => "Opening the archive.",
  "check-in": ({ authPhase }) => checkInAnnouncement(authPhase),
  "logout-error": () => "We could not finish signing you out.",
  "network-error": () => "Switch to Gnosis Chain to continue.",
  "session-error": () => "We could not restore your member session.",
  "signing-out": () => "Signing you out of Valhalla.",
  archive: ({ visibleFilesCount }) =>
    `Guild archive open with ${visibleFilesCount} ${
      visibleFilesCount === 1 ? "file" : "files"
    } available.`,
  idle: () => "",
  loading: ({ isConnecting }) =>
    isConnecting
      ? "Connecting your wallet."
      : "Checking for an existing member session.",
};

type GatePanelProps = {
  description: string;
  title: string;
  children?: ReactNode;
  error?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  isLoading?: boolean;
  tone?: "default" | "error";
};

function GatePanel({
  children,
  description,
  error,
  headingRef,
  isLoading = false,
  title,
  tone = "default",
}: GatePanelProps) {
  return (
    <section
      className={"gate-card" + (tone === "error" ? " gate-card--error" : "")}
      aria-busy={isLoading || undefined}
    >
      <div className="gate-copy">
        <h2
          className="gate-title"
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
        >
          {isLoading ? (
            <span className="loading-mark" aria-hidden="true" />
          ) : null}
          {title}
        </h2>
        <p className="gate-description">{description}</p>
        {error ? (
          <p className="gate-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {children ? <div className="gate-action">{children}</div> : null}
    </section>
  );
}

function fileLabel(key: string) {
  const pathParts = key.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] || key;

  return fileName.replace(/\.[^/.]+$/, "");
}

export default function Home() {
  return (
    <main className="valhalla-main">
      <HomeContent />
    </main>
  );
}

function HomeContent() {
  const { address, chainId, isConnecting } = useAccount();
  const { reset: resetSignature, signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState("");
  const [authPhase, setAuthPhase] = useState<AuthPhase>("idle");
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelsBeingFetched, setChannelsBeingFetched] = useState<Set<string>>(
    new Set(),
  );
  const focusTargetRef = useRef<HTMLHeadingElement>(null);
  const focusAfterTransitionRef = useRef(false);
  const authAttemptRef = useRef(0);
  const logoutRequestRef = useRef<Promise<void> | null>(null);
  const previousAddressRef = useRef<string | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const walletConnectRequestedRef = useRef(false);

  const finishLogout = useCallback(() => {
    if (logoutRequestRef.current) return logoutRequestRef.current;

    setIsEndingSession(true);
    setLogoutError("");

    const request = logoutAuthSession()
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to end your session right now.";
        setLogoutError(message);
        throw error;
      })
      .finally(() => {
        logoutRequestRef.current = null;
        setIsEndingSession(false);
      });

    logoutRequestRef.current = request;
    return request;
  }, []);

  const {
    data: authSession,
    error: sessionError,
    isLoading: isSessionLoading,
    refetch: refetchSession,
  } = useQuery<AuthSession, Error>({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: getAuthSession,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const sessionAddress = authSession?.authenticated
    ? authSession.address
    : undefined;
  const walletMatchesSession =
    address &&
    sessionAddress &&
    address.toLowerCase() === sessionAddress.toLowerCase();
  const hasVerifiedAccess = Boolean(
    address && sessionAddress && walletMatchesSession,
  );

  const {
    error: authError,
    isPending: isAuthenticating,
    mutate: authenticate,
    reset: resetAuthentication,
  } = useMutation<
    AuthSession,
    Error,
    { address: Address; attemptId: number; chainId: number }
  >({
    mutationFn: async ({
      address: walletAddress,
      attemptId,
      chainId: walletChainId,
    }) => {
      setActionError("");
      const message = await createAuthMessage(walletAddress, walletChainId);

      if (authAttemptRef.current !== attemptId) {
        throw new Error("Wallet connection changed. Please try again.");
      }

      setAuthPhase("awaiting-signature");
      const signature = await signMessageAsync({
        account: walletAddress,
        message,
      });

      if (authAttemptRef.current !== attemptId) {
        throw new Error("Wallet connection changed. Please try again.");
      }

      setAuthPhase("verifying");
      const session = await verifyAuthMessage(message, signature);

      if (authAttemptRef.current !== attemptId) {
        queryClient.setQueryData<AuthSession>(AUTH_SESSION_QUERY_KEY, {
          authenticated: false,
        });
        queryClient.removeQueries({ queryKey: ["valhalla-files"] });
        await finishLogout();
        throw new Error("Wallet connection changed. Please try again.");
      }

      if (!session.authenticated) {
        throw new Error("Wallet verification did not create a session.");
      }

      return session;
    },
    onSuccess: (session) => {
      focusAfterTransitionRef.current = true;
      setActionError("");
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, session);
    },
    onSettled: (_, __, variables) => {
      if (authAttemptRef.current === variables.attemptId) {
        setAuthPhase("idle");
      }
    },
  });

  const {
    data: files = [],
    error: filesError,
    isFetching: isFilesFetching,
    isLoading: isFilesLoading,
    refetch: refetchFiles,
  } = useQuery<ValhallaFile[], Error>({
    queryKey: ["valhalla-files", sessionAddress],
    queryFn: getValhallaFiles,
    enabled: hasVerifiedAccess,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const {
    error: fileError,
    mutate: openFileChannel,
    reset: resetFileRequest,
  } = useMutation<string, Error, string>({
    mutationFn: getValhallaFile,
    onMutate: (key) =>
      setChannelsBeingFetched((previous) => {
        const next = new Set(previous);
        next.add(key);
        return next;
      }),
    onSuccess: (file) => {
      const openedWindow = window.open(file, "_blank", "noopener,noreferrer");
      if (openedWindow) openedWindow.opener = null;
    },
    onSettled: (_, __, key) =>
      setChannelsBeingFetched((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      }),
  });

  const getFile = (key: string) => {
    setActionError("");

    if (!hasVerifiedAccess) {
      setActionError("Your member session is no longer available.");
      return;
    }

    openFileChannel(key);
  };

  const visibleFiles = useMemo(
    () => files.filter((file) => !file.Key.endsWith("/")),
    [files],
  );
  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return visibleFiles;

    return visibleFiles
      .map((file, index) => {
        const labelScore = fuzzyScore(query, fileLabel(file.Key));
        const pathScore = fuzzyScore(query, file.Key);
        const score = Math.max(labelScore ?? -Infinity, pathScore ?? -Infinity);

        return { file, index, score };
      })
      .filter(({ score }) => Number.isFinite(score))
      .sort((first, second) => {
        if (second.score !== first.score) return second.score - first.score;
        return first.index - second.index;
      })
      .map(({ file }) => file);
  }, [searchQuery, visibleFiles]);
  const errorMessage = actionError || fileError?.message;
  const accessState = resolveAccessState({
    address,
    chainId,
    filesError,
    hasVerifiedAccess,
    isConnecting,
    isEndingSession,
    isFilesLoading,
    isSessionLoading,
    logoutError,
    sessionError,
  });
  const statusAnnouncement = STATUS_ANNOUNCEMENTS[accessState]({
    authPhase,
    isConnecting,
    visibleFilesCount: visibleFiles.length,
  });

  useEffect(() => {
    const protectedAccessError = [filesError, fileError].find(
      (error) =>
        error instanceof ApiRequestError &&
        (error.status === 401 || error.status === 403),
    );

    if (!protectedAccessError) return;

    authAttemptRef.current += 1;
    queryClient.setQueryData<AuthSession>(AUTH_SESSION_QUERY_KEY, {
      authenticated: false,
    });
    queryClient.removeQueries({ queryKey: ["valhalla-files"] });
    resetSignature();
    resetAuthentication();
    resetFileRequest();
    // The reset helpers clear related errors, so restore this message after
    // their state updates have settled.
    queueMicrotask(() => {
      setAuthPhase("idle");
      setActionError(protectedAccessError.message);
    });
    void finishLogout().catch(() => undefined);
  }, [
    fileError,
    filesError,
    finishLogout,
    queryClient,
    resetAuthentication,
    resetFileRequest,
    resetSignature,
  ]);

  useEffect(() => {
    const handleWalletConnectRequest = () => {
      walletConnectRequestedRef.current = true;
    };

    window.addEventListener(
      WALLET_CONNECT_REQUESTED_EVENT,
      handleWalletConnectRequest,
    );

    return () =>
      window.removeEventListener(
        WALLET_CONNECT_REQUESTED_EVENT,
        handleWalletConnectRequest,
      );
  }, []);

  useEffect(() => {
    const previousAddress = previousAddressRef.current;
    const accountChanged =
      Boolean(previousAddress) && previousAddress !== address;
    const connectedAccountDoesNotMatchSession = Boolean(
      address &&
      sessionAddress &&
      address.toLowerCase() !== sessionAddress.toLowerCase(),
    );

    if (accountChanged || connectedAccountDoesNotMatchSession) {
      authAttemptRef.current += 1;
      queryClient.setQueryData<AuthSession>(AUTH_SESSION_QUERY_KEY, {
        authenticated: false,
      });
      queryClient.removeQueries({ queryKey: ["valhalla-files"] });
      resetSignature();
      resetAuthentication();
      resetFileRequest();
      queueMicrotask(() => {
        setActionError("");
        setAuthPhase("idle");
      });
      void finishLogout().catch(() => undefined);
    }

    if (
      address &&
      address !== previousAddress &&
      walletConnectRequestedRef.current
    ) {
      focusAfterTransitionRef.current = true;
    }

    if (address) {
      walletConnectRequestedRef.current = false;
    }

    previousAddressRef.current = address;
  }, [
    address,
    finishLogout,
    queryClient,
    resetAuthentication,
    resetFileRequest,
    resetSignature,
    sessionAddress,
  ]);

  useEffect(() => {
    if (
      !focusAfterTransitionRef.current ||
      accessState === "idle" ||
      accessState === "loading"
    ) {
      return;
    }

    focusAfterTransitionRef.current = false;
    const frame = window.requestAnimationFrame(() =>
      focusTargetRef.current?.focus(),
    );

    return () => window.cancelAnimationFrame(frame);
  }, [accessState]);

  const clearSearch = () => {
    setSearchQuery("");
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const renderWithStatus = (content: ReactNode) => (
    <>
      <p className="visually-hidden" role="status" aria-atomic="true">
        {statusAnnouncement}
      </p>
      {content}
    </>
  );

  if (!hasVerifiedAccess) {
    let accessContent: ReactNode;

    if (isEndingSession) {
      accessContent = (
        <GatePanel
          title="Signing you out"
          description="We’re clearing your retained Valhalla session."
          headingRef={focusTargetRef}
          isLoading
        />
      );
    } else if (logoutError) {
      accessContent = (
        <GatePanel
          title="We couldn’t finish signing you out"
          description="Retry before connecting or verifying another wallet."
          error={logoutError}
          headingRef={focusTargetRef}
          tone="error"
        >
          <button
            className="rg-button rg-button--primary"
            type="button"
            onClick={() => void finishLogout().catch(() => undefined)}
          >
            Retry sign out
          </button>
        </GatePanel>
      );
    } else if (isSessionLoading || isConnecting) {
      accessContent = (
        <GatePanel
          title={
            isConnecting
              ? "Connecting your wallet"
              : "Checking your member session"
          }
          description={
            isConnecting
              ? "Complete the connection in your wallet to continue."
              : "We’re looking for a previous Valhalla sign-in."
          }
          headingRef={focusTargetRef}
          isLoading
        />
      );
    } else if (sessionError) {
      accessContent = (
        <GatePanel
          title="We couldn’t restore your session"
          description="Try again to check for an existing Valhalla sign-in."
          error={sessionError.message}
          headingRef={focusTargetRef}
          tone="error"
        >
          <button
            className="rg-button rg-button--primary"
            type="button"
            onClick={() => {
              focusAfterTransitionRef.current = true;
              void refetchSession();
            }}
          >
            Try again
          </button>
        </GatePanel>
      );
    } else if (!address) {
      accessContent = (
        <div className="hero-action">
          <WalletControl variant="primary" />
        </div>
      );
    } else if (chainId !== gnosis.id) {
      accessContent = (
        <GatePanel
          title="Switch to Gnosis Chain"
          description="Valhalla verifies RaidGuild membership on Gnosis Chain."
          headingRef={focusTargetRef}
        >
          <WalletControl variant="primary" />
        </GatePanel>
      );
    } else {
      accessContent = (
        <GatePanel
          title="Verify your membership"
          description={
            authPhase === "awaiting-signature"
              ? "Approve the sign-in message in your wallet. There is no transaction or gas fee."
              : authPhase === "verifying"
                ? "Your signature is complete. We’re checking your RaidGuild shares."
                : "Sign once to start a seven-day Valhalla session. There is no transaction or gas fee."
          }
          error={actionError || authError?.message}
          headingRef={focusTargetRef}
          isLoading={isAuthenticating}
          tone={actionError || authError ? "error" : "default"}
        >
          <button
            className="rg-button rg-button--primary"
            type="button"
            disabled={isAuthenticating}
            aria-busy={isAuthenticating || undefined}
            onClick={() => {
              if (!address || chainId !== gnosis.id) return;
              focusAfterTransitionRef.current = true;
              const attemptId = authAttemptRef.current + 1;
              authAttemptRef.current = attemptId;
              setAuthPhase("preparing");
              authenticate({ address, attemptId, chainId });
            }}
          >
            {authPhase === "awaiting-signature"
              ? "Check your wallet"
              : authPhase === "verifying"
                ? "Verifying membership"
                : authPhase === "preparing"
                  ? "Preparing sign-in"
                  : "Sign in to Valhalla"}
          </button>
        </GatePanel>
      );
    }

    return renderWithStatus(
      <section
        className={"hero" + (address ? " hero--connected" : "")}
        aria-labelledby="valhalla-title"
      >
        <div className="hero-copy">
          <p className="eyebrow">Members’ archive</p>
          <h1 className="hero-title" id="valhalla-title">
            Enter <em>Valhalla.</em>
          </h1>
          <p className="hero-description">
            A private archive of all RaidGuild Discord server channels. Connect
            your member wallet and verify your membership to enter.
          </p>
          <div className="hero-access">{accessContent}</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <Image
            className="hero-art-image"
            src="/brand/portal-arch-c.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 48vw"
          />
        </div>
      </section>,
    );
  }

  return renderWithStatus(
    <section className="archive" aria-labelledby="archive-title">
      <header className="archive-header">
        <div className="archive-heading-group">
          <p className="eyebrow">Members’ archive</p>
          <h1
            className="archive-title"
            id="archive-title"
            ref={focusTargetRef}
            tabIndex={-1}
          >
            Guild archive
          </h1>
        </div>
        <span className="archive-count">
          {isFilesLoading
            ? "Opening archive"
            : filesError
              ? "Archive unavailable"
              : `${visibleFiles.length} ${
                  visibleFiles.length === 1 ? "file" : "files"
                } available`}
        </span>
      </header>

      {visibleFiles.length > 0 ? (
        <div className="archive-tools">
          <div className="archive-search">
            <LuSearch className="archive-search-icon" aria-hidden="true" />
            <label className="visually-hidden" htmlFor="channel-search">
              Search channels
            </label>
            <input
              id="channel-search"
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              placeholder="Search channels"
              autoComplete="off"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchQuery("");
              }}
            />
            {searchQuery ? (
              <button
                className="archive-search-clear"
                type="button"
                aria-label="Clear channel search"
                onClick={clearSearch}
              >
                <LuX aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <p className="archive-search-status" aria-live="polite">
            {searchQuery.trim()
              ? `${filteredFiles.length} of ${visibleFiles.length} channels`
              : "Search by channel name"}
          </p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="alert" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {isFilesLoading ? (
        <div className="archive-state" aria-busy="true">
          <span className="loading-mark" aria-hidden="true" />
          <h2 className="archive-state-title">Opening the archive</h2>
          <p>We’re gathering the files behind the gate.</p>
        </div>
      ) : filesError ? (
        <div className="archive-state archive-state--error" role="alert">
          <span className="brand-crystal" aria-hidden="true" />
          <h2 className="archive-state-title">The archive did not open</h2>
          <p>{filesError.message}</p>
          <button
            className="rg-button rg-button--secondary"
            type="button"
            disabled={isFilesFetching}
            onClick={() => {
              focusAfterTransitionRef.current = true;
              void refetchFiles();
            }}
          >
            {isFilesFetching ? "Trying again" : "Try again"}
          </button>
        </div>
      ) : filteredFiles.length > 0 ? (
        <ul className="file-grid">
          {filteredFiles.map((file) => {
            const key = file.Key;
            const isOpening = channelsBeingFetched.has(key);

            return (
              <li key={key}>
                <button
                  className="file-card"
                  type="button"
                  disabled={isOpening}
                  aria-busy={isOpening || undefined}
                  aria-label={`Open file ${key} in a new tab`}
                  title={key}
                  onClick={() => getFile(key)}
                >
                  <span className="file-card-leading" aria-hidden="true">
                    {isOpening ? (
                      <span className="file-card-spinner" />
                    ) : (
                      <LuFileText className="file-card-icon" />
                    )}
                  </span>
                  <span className="file-card-copy">
                    <span className="file-card-title">
                      {isOpening ? "Opening…" : fileLabel(key)}
                    </span>
                    <span className="file-card-path">{key}</span>
                  </span>
                  <LuExternalLink
                    className="file-card-arrow"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : searchQuery.trim() ? (
        <div className="archive-state archive-state--search">
          <LuSearch className="archive-state-search-icon" aria-hidden="true" />
          <h2 className="archive-state-title">No matching channels</h2>
          <p>Try another channel name or clear the search.</p>
          <button
            className="rg-button rg-button--secondary"
            type="button"
            onClick={clearSearch}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="archive-state">
          <span className="brand-crystal" aria-hidden="true" />
          <h2 className="archive-state-title">Nothing beyond the gate yet</h2>
          <p>The gate is open, but no files are available yet.</p>
        </div>
      )}
    </section>,
  );
}
