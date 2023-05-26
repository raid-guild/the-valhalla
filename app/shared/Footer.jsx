'use client';

import { Flex, Text } from '@chakra-ui/react';
import { GiMedievalGate } from 'react-icons/gi';

export const Footer = () => {
  return (
    <Flex
      direction='row'
      justifyContent='flex-end'
      alignItems='center'
      py='2rem'
      px='4rem'
      mt='2rem'
    >
      <Text fontSize='18px' mr='1rem'>
        <GiMedievalGate />
      </Text>
      <Text fontSize='18px' fontWeight='bold'>
        The Valhalla
      </Text>
    </Flex>
  );
};
