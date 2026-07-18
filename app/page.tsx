"use client";

import { useState } from "react";
import { useAccount, useBalance, useSignMessage } from "wagmi";
import { Flex, Button, SimpleGrid, Spinner, Text } from "@chakra-ui/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getValhallaFiles, getValhallaFile } from "./utils/requests";
import { gnosis } from "viem/chains";
import { _Object } from "@aws-sdk/client-s3";
import { useMutation, useQuery } from "@tanstack/react-query";

const SHARES_TOKEN_ADDRESS = "0x372fc5a6b0b12ae174f09f6fc849a83de6b503b6";
const MEMBERSHIP_THRESHOLD = 100;

export default function Home() {
  return (
    <Flex
      direction="column"
      w="100%"
      alignItems="center"
      justifyContent="center"
    >
      <HomeContent />
    </Flex>
  );
}

const HomeContent = () => {
  const { address, isConnecting } = useAccount();
  const {
    data: signatureData,
    signMessage,
    isSuccess: isSignSuccess,
  } = useSignMessage();

  const {
    data: shares,
    isLoading: isSharesLoading,
    isFetching: isSharesFetching,
  } = useBalance({
    token: SHARES_TOKEN_ADDRESS,
    address,
    chainId: gnosis.id,
    query: {
      refetchOnWindowFocus: false,
    },
  });

  const [actionError, setActionError] = useState("");
  const isMember =
    !isSharesLoading &&
    !isSharesFetching &&
    Number(shares?.formatted || 0) >= MEMBERSHIP_THRESHOLD;

  const {
    data: files = [],
    isFetching: isFilesFetching,
    error: filesError,
  } = useQuery<_Object[], Error>({
    queryKey: ["valhalla-files", signatureData],
    queryFn: () => getValhallaFiles(signatureData as string),
    enabled: Boolean(signatureData),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const [channelsBeingFetched, setChannelsBeingFetched] = useState<Set<string>>(
    new Set()
  );

  const { mutate: openFileChannel, error: fileError } = useMutation<
    string,
    Error,
    string
  >({
    mutationFn: (key: string) => getValhallaFile(signatureData as string, key),
    onMutate: (key) =>
      setChannelsBeingFetched((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      }),
    onSuccess: (file) => window.open(file, "_blank"),
    onSettled: (_, __, key) =>
      setChannelsBeingFetched((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
  });

  const getFile = (key: string | undefined) => {
    setActionError("");
    if (!key) {
      setActionError("Invalid file key");
      return;
    }

    if (!signatureData) {
      setActionError("Invalid signature");
      return;
    }

    openFileChannel(key);
  };

  const errorMessage = actionError || fileError?.message || filesError?.message;

  if (isFilesFetching || isSharesLoading || isSharesFetching)
    return <Spinner size="xl" />;
  if (!address && !isConnecting) return <ConnectButton />;
  if (shares !== undefined && !isMember) {
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
        {files.slice(1).map((file) => {
          const key = file.Key;
          if (!key) return null;
          return (
            <Button
              key={key}
              px="10px"
              py="10px"
              cursor="pointer"
              fontWeight="normal"
              border="2px solid white"
              bg="black"
              color="white"
              _hover={{ opacity: 0.7 }}
              loading={channelsBeingFetched.has(key)}
              loadingText="Querying.."
              onClick={() => getFile(key)}
            >
              {key.length > 30 ? `${key.slice(0, 25)}...` : key.slice(0, -5)}
            </Button>
          );
        })}
      </SimpleGrid>
    </Flex>
  );
};
