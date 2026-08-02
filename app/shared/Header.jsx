"use client";

import Image from "next/image";
import Link from "next/link";

import { WalletControl } from "./WalletControl";

export const Header = () => {
  return (
    <header className="site-header">
      <Link className="brand-home-link" href="/" aria-label="The Valhalla home">
        <Image
          className="brand-logo-full"
          src="/brand/full-m800.svg"
          alt="RaidGuild"
          width={168}
          height={44}
          priority
          unoptimized
        />
        <Image
          className="brand-logo-symbol"
          src="/brand/symbol-m500.svg"
          alt="RaidGuild"
          width={40}
          height={38}
          priority
          unoptimized
        />
        <span className="brand-context">The Valhalla</span>
      </Link>
      <WalletControl />
    </header>
  );
};
