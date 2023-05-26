'use client';

import { Flex, Text, Button, SimpleGrid, Spinner } from '@chakra-ui/react';

import { useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { Web3Button } from '@web3modal/react';
import { getValhallaFiles, getValhallaFile } from './utils/requests';

export default function Home() {
  const { address } = useAccount();
  const { data, isLoading, isSuccess, signMessage } = useSignMessage({
    message: 'gm raidguild member'
  });

  const [files, setFiles] = useState([]);

  const [isMember, setIsMember] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const getMemberShares = async () => {
    const abi = new Interface([
      'function members(address account) view returns (address, uint256, uint256, bool, uint256, uint256)'
    ]);
    const contract = new Contract(
      '0xfe1084bc16427e5eb7f13fc19bcd4e641f7d571f',
      abi,
      new JsonRpcProvider('https://rpc.ankr.com/gnosis')
    );

    const member = await contract.members(address);
    setIsMember(member[3]);
  };

  const listFiles = async () => {
    setIsFetching(true);
    const files = await getValhallaFiles(data);
    setFiles(files);
    setIsFetching(false);
  };

  const getFile = async (key) => {
    setIsFetching(true);
    const file = await getValhallaFile(data, key);
    setIsFetching(false);
    window.open(file, '_blank');
  };

  useEffect(() => {
    if (isSuccess) listFiles();
  }, [isSuccess]);

  useEffect(() => {
    if (address) {
      getMemberShares();
    }
  }, [address]);

  return (
    <Flex
      direction='column'
      w='100%'
      alignItems='center'
      justifyContent='center'
    >
      {address ? (
        isMember ? (
          !data ? (
            <Button
              mx='auto'
              bg='#fe3965'
              color='white'
              isLoading={isLoading}
              _hover={{
                opacity: 0.8
              }}
              onClick={() => {
                try {
                  signMessage();
                } catch (err) {
                  console.log(err);
                }
              }}
            >
              Check in to valhalla
            </Button>
          ) : isFetching ? (
            <Spinner size='xl' />
          ) : (
            <SimpleGrid w='100%' columns={{ lg: 3, md: 2, sm: 1 }} gap={2}>
              {files.slice(1).map((file, index) => (
                <Button
                  px='10px'
                  py='10px'
                  cursor='pointer'
                  fontWeight='normal'
                  border='2px solid white'
                  bg='black'
                  color='white'
                  _hover={{
                    opacity: 0.7
                  }}
                  key={index}
                  isLoading={isFetching}
                  loadingText='Querying..'
                  onClick={() => {
                    getFile(file.Key);
                  }}
                >
                  {file.Key.slice(9, -5)}
                </Button>
              ))}
            </SimpleGrid>
          )
        ) : (
          <Text>Not a member</Text>
        )
      ) : (
        <Web3Button />
      )}
    </Flex>
  );
}
