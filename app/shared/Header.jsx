'use client';

import { Flex, Image as ChakraImage } from '@chakra-ui/react';

import { Web3Button } from '@web3modal/react';

import { useAccount } from 'wagmi';

export const Header = () => {
  const { address } = useAccount();

  return (
    <Flex
      h='100px'
      w='100%'
      alignItems='center'
      justifyContent='space-between'
      px='2rem'
    >
      <ChakraImage src='/raidguild.webp' alt='RaidGuild Valhalla' w='100px' />
      {address && <Web3Button />}
    </Flex>
  );
};
