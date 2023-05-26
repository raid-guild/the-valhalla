'use client';

import './globals.css';
import { Titillium_Web } from 'next/font/google';
import { Providers } from './providers';
import { Flex } from '@chakra-ui/react';
import { Footer } from './shared/Footer';
import { Header } from './shared/Header';

import {
  EthereumClient,
  w3mConnectors,
  w3mProvider
} from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/react';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import { gnosis } from 'wagmi/chains';

const chains = [gnosis];
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

const { publicClient } = configureChains(chains, [w3mProvider({ projectId })]);
const wagmiConfig = createConfig({
  autoConnect: false,
  connectors: w3mConnectors({ projectId, version: 1, chains }),
  publicClient
});
const ethereumClient = new EthereumClient(wagmiConfig, chains);

const titillium = Titillium_Web({ subsets: ['latin'], weight: ['400'] });

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body className={titillium.className}>
        <Providers>
          <WagmiConfig config={wagmiConfig}>
            <Flex
              direction='column'
              justifyContent='space-between'
              maxW='80rem'
              minH='100vh'
              mx='auto'
              pt='2rem'
              px={{ lg: '4rem', sm: '2rem' }}
              bg='black'
              color='white'
            >
              <Header />
              {children}
              <Footer />
            </Flex>
          </WagmiConfig>
        </Providers>
        <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
      </body>
    </html>
  );
}
