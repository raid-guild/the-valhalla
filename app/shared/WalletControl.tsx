"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";

export const WALLET_CONNECT_REQUESTED_EVENT =
  "valhalla:wallet-connect-requested";

type WalletControlProps = {
  showWhenDisconnected?: boolean;
  variant?: "header" | "primary";
};

type WalletButtonProps = WalletControlProps & {
  accountDisplayName?: string;
  chainUnsupported: boolean;
  connected: boolean;
  openAccountModal: () => void;
  openChainModal: () => void;
  openConnectModal: () => void;
  ready: boolean;
};

function WalletButton({
  accountDisplayName,
  chainUnsupported,
  connected,
  openAccountModal,
  openChainModal,
  openConnectModal,
  ready,
  showWhenDisconnected = true,
  variant = "header",
}: WalletButtonProps) {
  const [connectRequested, setConnectRequested] = useState(false);
  const buttonClass =
    variant === "header"
      ? "rg-button rg-button--secondary rg-button--header"
      : "rg-button rg-button--primary";

  useEffect(() => {
    if (!ready || !connectRequested) return;

    openConnectModal();
    const resetRequest = window.setTimeout(() => setConnectRequested(false), 0);

    return () => window.clearTimeout(resetRequest);
  }, [connectRequested, openConnectModal, ready]);

  return (
    <div className="wallet-control">
      {!connected ? (
        showWhenDisconnected ? (
          <button
            className={buttonClass}
            type="button"
            disabled={connectRequested}
            onClick={() => {
              window.dispatchEvent(new Event(WALLET_CONNECT_REQUESTED_EVENT));

              if (ready) {
                openConnectModal();
                return;
              }

              setConnectRequested(true);
            }}
          >
            {connectRequested ? "Opening wallet…" : "Connect wallet"}
          </button>
        ) : null
      ) : chainUnsupported ? (
        <button className={buttonClass} type="button" onClick={openChainModal}>
          Switch network
        </button>
      ) : (
        <button
          className={buttonClass}
          type="button"
          onClick={openAccountModal}
          aria-label={`Wallet ${accountDisplayName}. Open account menu.`}
        >
          {accountDisplayName}
        </button>
      )}
    </div>
  );
}

export function WalletControl({
  showWhenDisconnected = true,
  variant = "header",
}: WalletControlProps) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = Boolean(
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated"),
        );

        return (
          <WalletButton
            accountDisplayName={account?.displayName}
            chainUnsupported={Boolean(chain?.unsupported)}
            connected={connected}
            openAccountModal={openAccountModal}
            openChainModal={openChainModal}
            openConnectModal={openConnectModal}
            ready={ready}
            showWhenDisconnected={showWhenDisconnected}
            variant={variant}
          />
        );
      }}
    </ConnectButton.Custom>
  );
}
