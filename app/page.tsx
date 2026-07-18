"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useSignMessage } from "wagmi";
import { Flex, Button, SimpleGrid, Spinner, Text } from "@chakra-ui/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getValhallaFiles, getValhallaFile } from "./utils/requests";
import { gnosis } from "viem/chains";
import { _Object } from "@aws-sdk/client-s3";

const SHARES_TOKEN_ADDRESS = "0x372fc5a6b0b12ae174f09f6fc849a83de6b503b6";
const MEMBERSHIP_THRESHOLD = 100;

export default function Home() {
  const { address } = useAccount();
  const {
    data: signatureData,
    signMessage,
    isSuccess: isSignSuccess,
  } = useSignMessage();

  const { data: shares } = useBalance({
    token: SHARES_TOKEN_ADDRESS,
    address,
    chainId: gnosis.id,
  });

  const [files, setFiles] = useState<_Object[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  console.log({ signatureData, files });

  useEffect(() => {
    if (shares && Number(shares?.formatted) >= MEMBERSHIP_THRESHOLD) {
      setIsMember(true);
    }
  }, [shares, address]);

  const listFiles = async () => {
    setIsFetching(true);
    setErrorMessage("");
    if (!signatureData) {
      setErrorMessage("Invalid signature");
      return;
    }
    try {
      const fetchedFiles = await getValhallaFiles(signatureData);
      setFiles(fetchedFiles);
    } catch (error) {
      console.error("Error fetching files:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to fetch files. Please try again."
      );
    } finally {
      setIsFetching(false);
    }
  };

  const getFile = async (key: string | undefined) => {
    setIsFetching(true);
    setErrorMessage("");
    if (!key) {
      setErrorMessage("Invalid file key");
      return;
    }

    if (!signatureData) {
      setErrorMessage("Invalid signature");
      return;
    }

    try {
      const file = await getValhallaFile(signatureData, key);

      window.open(file, "_blank");
    } catch (error) {
      console.error("Error getting file:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to open file. Please try again."
      );
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
    if (!isMember) {
      return (
        <Text color="#fe3965" textAlign="center">
          Your wallet address is not a RaidGuild member.
        </Text>
      );
    }

    if (isMember && !isSignSuccess) {
      return (
        <Button
          mx="auto"
          bg="#fe3965"
          color="white"
          _hover={{ opacity: 0.8 }}
          onClick={() => signMessage({ message: "gm raidguild member" })}
        >
          Check in to Valhalla
        </Button>
      );
    }

    return (
      <Flex direction="column" w="100%" gap={4}>
        {errorMessage ? (
          <Text color="#fe3965" textAlign="center">
            {errorMessage}
          </Text>
        ) : null}
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
              loading={isFetching}
              loadingText="Querying.."
              onClick={() => getFile(file.Key)}
            >
              {file?.Key?.length && file.Key.length > 30
                ? `${file.Key?.slice(0, 25)}...`
                : file.Key?.slice(0, -5)}
            </Button>
          ))}
        </SimpleGrid>
      </Flex>
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
