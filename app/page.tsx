"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { LuExternalLink, LuFileText, LuSearch, LuX } from "react-icons/lu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useSignMessage } from "wagmi";
import { gnosis } from "viem/chains";

import {
  WALLET_CONNECT_REQUESTED_EVENT,
  WalletControl,
} from "./shared/WalletControl";
import { fuzzyScore } from "./utils/fuzzy";
import {
  getValhallaFile,
  getValhallaFiles,
  type ValhallaFile,
} from "./utils/requests";

const SHARES_TOKEN_ADDRESS = "0x372fc5a6b0b12ae174f09f6fc849a83de6b503b6";
const MEMBERSHIP_THRESHOLD = 100;

type GatePanelProps = {
  description: string;
  title: string;
  children?: ReactNode;
  error?: string;
  eyebrow?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  isLoading?: boolean;
  tone?: "default" | "error";
};

function GatePanel({
  children,
  description,
  error,
  eyebrow,
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
        {eyebrow ? <p className="eyebrow gate-eyebrow">{eyebrow}</p> : null}
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
  const { address } = useAccount();

  return (
    <main className="valhalla-main">
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
            {address
              ? "Your member wallet is connected. Your archive access appears below."
              : "A private archive of all RaidGuild Discord server channels. Connect your member wallet to enter."}
          </p>
          <div className="hero-action">
            {!address ? (
              <p className="eyebrow hero-step">Step 01 · Connect</p>
            ) : null}
            <WalletControl variant="primary" />
          </div>
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
      </section>
      <HomeContent />
    </main>
  );
}

function HomeContent() {
  const { address, isConnecting } = useAccount();
  const {
    data: signatureData,
    error: signError,
    isPending: isSigning,
    isSuccess: isSignSuccess,
    signMessage,
  } = useSignMessage();

  const {
    data: shares,
    error: sharesError,
    isFetching: isSharesFetching,
    isLoading: isSharesLoading,
    refetch: refetchShares,
  } = useBalance({
    token: SHARES_TOKEN_ADDRESS,
    address,
    chainId: gnosis.id,
    query: {
      refetchOnWindowFocus: false,
    },
  });

  const [actionError, setActionError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelsBeingFetched, setChannelsBeingFetched] = useState<Set<string>>(
    new Set(),
  );
  const focusTargetRef = useRef<HTMLHeadingElement>(null);
  const focusAfterTransitionRef = useRef(false);
  const previousAddressRef = useRef<string | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const walletConnectRequestedRef = useRef(false);

  const isMember =
    !isSharesLoading &&
    !isSharesFetching &&
    Number(shares?.formatted || 0) >= MEMBERSHIP_THRESHOLD;

  const {
    data: files = [],
    error: filesError,
    isFetching: isFilesFetching,
    isLoading: isFilesLoading,
    refetch: refetchFiles,
  } = useQuery<ValhallaFile[], Error>({
    queryKey: ["valhalla-files", signatureData],
    queryFn: () => getValhallaFiles(signatureData as string),
    enabled: Boolean(signatureData),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { error: fileError, mutate: openFileChannel } = useMutation<
    string,
    Error,
    string
  >({
    mutationFn: (key: string) => getValhallaFile(signatureData as string, key),
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

    if (!signatureData) {
      setActionError("Your check-in signature is no longer available.");
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
  const isCheckingAccess =
    isConnecting || isSharesLoading || isSharesFetching || isFilesLoading;
  const accessState = isCheckingAccess
    ? "loading"
    : !address
      ? "idle"
      : sharesError
        ? "membership-error"
        : shares !== undefined && !isMember
          ? "not-member"
          : isMember && !isSignSuccess
            ? "check-in"
            : !isSignSuccess
              ? "verification-error"
              : filesError
                ? "archive-error"
                : "archive";
  const statusAnnouncement =
    accessState === "loading"
      ? isFilesLoading
        ? "Opening the archive."
        : "Reading your guild shares."
      : accessState === "membership-error"
        ? "We could not read your membership."
        : accessState === "not-member"
          ? "This wallet is not recognized as a RaidGuild member."
          : accessState === "check-in"
            ? "Membership confirmed. Sign a free message to open the archive."
            : accessState === "verification-error"
              ? "We could not confirm your membership."
              : accessState === "archive-error"
                ? "The archive did not open. Try again."
                : accessState === "archive"
                  ? `Guild archive open with ${visibleFiles.length} ${
                      visibleFiles.length === 1 ? "file" : "files"
                    } available.`
                  : "";

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
    if (
      address &&
      address !== previousAddressRef.current &&
      walletConnectRequestedRef.current
    ) {
      focusAfterTransitionRef.current = true;
    }

    if (address) {
      walletConnectRequestedRef.current = false;
    }

    previousAddressRef.current = address;
  }, [address]);

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

  useEffect(() => {
    if (signError) {
      focusAfterTransitionRef.current = false;
    }
  }, [signError]);

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

  if (isCheckingAccess) {
    return renderWithStatus(
      <div className="access-region">
        <GatePanel
          title={
            isFilesLoading ? "Opening the archive" : "Reading your guild shares"
          }
          description={
            isFilesLoading
              ? "Your membership is confirmed. We’re gathering the files behind the gate."
              : "We’re checking this wallet’s RaidGuild membership."
          }
          headingRef={focusTargetRef}
          isLoading
        />
      </div>,
    );
  }

  if (!address) {
    return renderWithStatus(null);
  }

  if (sharesError) {
    return renderWithStatus(
      <div className="access-region">
        <GatePanel
          title="We couldn’t read your membership"
          description="Try again or connect another wallet."
          headingRef={focusTargetRef}
          tone="error"
        >
          <button
            className="rg-button rg-button--primary"
            type="button"
            onClick={() => {
              focusAfterTransitionRef.current = true;
              void refetchShares();
            }}
          >
            Try again
          </button>
        </GatePanel>
      </div>,
    );
  }

  if (shares !== undefined && !isMember) {
    return renderWithStatus(
      <div className="access-region">
        <GatePanel
          title="This wallet isn’t recognized"
          description="Connect the wallet that holds your RaidGuild shares."
          headingRef={focusTargetRef}
          tone="error"
        />
      </div>,
    );
  }

  if (isMember && !isSignSuccess) {
    return renderWithStatus(
      <div className="access-region">
        <GatePanel
          title="Member confirmed"
          description="Sign a free message to open the archive."
          error={signError?.message}
          eyebrow="Step 02 · Verify"
          headingRef={focusTargetRef}
        >
          <button
            className="rg-button rg-button--primary"
            type="button"
            disabled={isSigning}
            onClick={() => {
              if (!address) return;
              focusAfterTransitionRef.current = true;
              signMessage({ account: address, message: "gm raidguild member" });
            }}
          >
            {isSigning ? "Awaiting signature" : "Check in to Valhalla"}
          </button>
        </GatePanel>
      </div>,
    );
  }

  if (!isSignSuccess) {
    return renderWithStatus(
      <div className="access-region">
        <GatePanel
          title="We couldn’t confirm your membership"
          description="Reconnect your wallet or try again."
          headingRef={focusTargetRef}
          tone="error"
        />
      </div>,
    );
  }

  return renderWithStatus(
    <section className="archive" aria-labelledby="archive-title">
      <header className="archive-header">
        <div className="archive-heading-group">
          <p className="eyebrow">Step 03 · Enter</p>
          <h2
            className="archive-title"
            id="archive-title"
            ref={focusTargetRef}
            tabIndex={-1}
          >
            Guild archive
          </h2>
        </div>
        <span className="archive-count">
          {filesError
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

      {filesError ? (
        <div className="archive-state archive-state--error" role="alert">
          <span className="brand-crystal" aria-hidden="true" />
          <h3 className="archive-state-title">The archive did not open</h3>
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
          <h3 className="archive-state-title">No matching channels</h3>
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
          <h3 className="archive-state-title">Nothing beyond the gate yet</h3>
          <p>The gate is open, but no files are available yet.</p>
        </div>
      )}
    </section>,
  );
}
