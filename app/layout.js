"use client";

import { Titillium_Web } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { gnosis } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

import { Providers } from "./providers";
import { Flex } from "@chakra-ui/react";
import { Header } from "./shared/Header";
import { Footer } from "./shared/Footer";
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

const config = getDefaultConfig({
  appName: "The Valhalla",
  projectId,
  chains: [gnosis],
  ssr: true,
});

const queryClient = new QueryClient();

const titillium = Titillium_Web({ subsets: ["latin"], weight: ["400"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={titillium.className}>
        <Providers>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider>
                <Flex
                  direction="column"
                  justifyContent="space-between"
                  maxW="80rem"
                  minH="100vh"
                  mx="auto"
                  pt="2rem"
                  px={{ lg: "4rem", sm: "2rem" }}
                  bg="black"
                  color="white"
                >
                  <Header />
                  {children}
                  <Footer />
                </Flex>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </Providers>
      </body>
    </html>
  );
}
