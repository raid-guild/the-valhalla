"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useSignMessage } from "wagmi";
import { Flex, Button, SimpleGrid, Spinner } from "@chakra-ui/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getValhallaFiles, getValhallaFile } from "./utils/requests";
import { gnosis } from "viem/chains";

const SHARES_TOKEN_ADDRESS = "0x372fc5a6b0b12ae174f09f6fc849a83de6b503b6";
const MEMBERSHIP_THRESHOLD = 100;

export default function Home() {
  const { address } = useAccount();
  const {
    data: signatureData,
    signMessage,
    isLoading: isSignLoading,
    isSuccess: isSignSuccess,
  } = useSignMessage();

  const { data: shares } = useBalance({
    token: SHARES_TOKEN_ADDRESS,
    address,
    chainId: gnosis.chainId,
  });

  const [files, setFiles] = useState([]);
  const [isMember, setIsMember] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  console.log({ signatureData, files });

  useEffect(() => {
    if (shares && shares?.formatted >= MEMBERSHIP_THRESHOLD) {
      setIsMember(true);
    }
  }, [shares, address]);

  const listFiles = async () => {
    setIsFetching(true);
    try {
      const fetchedFiles = await getValhallaFiles(signatureData);
      console.log({ fetchedFiles });
      setFiles(fetchedFiles);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const getFile = async (key) => {
    setIsFetching(true);
    try {
      const file = await getValhallaFile(signatureData, key);
      window.open(file, "_blank");
    } catch (error) {
      console.error("Error getting file:", error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    signatureData && listFiles();
  }, [signatureData]);

  const renderContent = () => {
    if (isFetching) return <Spinner size="xl" />;
    if (!address) return <ConnectButton />;
    if (isMember && !isSignSuccess) {
      return (
        <Button
          mx="auto"
          bg="#fe3965"
          color="white"
          isLoading={isSignLoading}
          _hover={{ opacity: 0.8 }}
          onClick={() => signMessage({ message: "gm raidguild member" })}
        >
          Check in to Valhalla
        </Button>
      );
    }

    return (
      <SimpleGrid w="100%" columns={{ lg: 3, md: 2, sm: 1 }} gap={2}>
        {files.slice(1).map((file, index) => (
          <Button
            key={index}
            px="10px"
            py="10px"
            cursor="pointer"
            fontWeight="normal"
            border="2px solid white"
            bg="black"
            color="white"
            _hover={{ opacity: 0.7 }}
            isLoading={isFetching}
            loadingText="Querying.."
            onClick={() => getFile(file.Key)}
          >
            {file.Key.slice(9, -5)}
          </Button>
        ))}
      </SimpleGrid>
    );
  };

  return (
    <Flex
      direction="column"
      w="100%"
      alignItems="center"
      justifyContent="center"
    >
      {renderContent()}
    </Flex>
  );
}
