"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  getDefaultConfig,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { gnosis } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/next";

import { Header } from "./shared/Header";
import { ebGaramond, maziusDisplay, ubuntuMono } from "./fonts";
import "./globals.css";

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

const config = getDefaultConfig({
  appName: "The Valhalla",
  projectId: projectId || "",
  chains: [gnosis],
  ssr: true,
});

const queryClient = new QueryClient();

const rainbowBaseTheme = lightTheme({
  accentColor: "#bd482d",
  accentColorForeground: "#f9f7e7",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

const raidGuildRainbowTheme = {
  ...rainbowBaseTheme,
  colors: {
    ...rainbowBaseTheme.colors,
    actionButtonBorder: "#d5cecd",
    actionButtonSecondaryBackground: "#f1efee",
    connectButtonBackground: "#bd482d",
    connectButtonText: "#f9f7e7",
    generalBorder: "#d5cecd",
    generalBorderDim: "#ece5ac",
    menuItemBackground: "#faeeeb",
    modalBackground: "#f9f7e7",
    modalBorder: "#d5cecd",
    modalText: "#29100a",
    modalTextDim: "#645754",
    modalTextSecondary: "#645754",
    profileAction: "#f1efee",
    profileActionHover: "#efc5bb",
    profileForeground: "#f9f7e7",
    selectedOptionBorder: "#bd482d",
  },
  fonts: {
    body: "var(--font-body)",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${maziusDisplay.variable} ${ebGaramond.variable} ${ubuntuMono.variable}`}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={raidGuildRainbowTheme}>
              <div className="site-shell">
                <Header />
                <div className="site-content">{children}</div>
              </div>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
        <Analytics />
      </body>
    </html>
  );
}
