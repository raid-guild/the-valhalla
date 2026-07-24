import axios from "axios";

export const MEMBER_SIGN_MESSAGE = "gm raidguild member";
export const NOT_MEMBER_ERROR =
  "Your wallet address is not a RaidGuild member.";

export type SignatureRequestBody = {
  signature: string;
};

export type ChannelRequestBody = SignatureRequestBody & {
  key: string;
};

export type MembersQueryResponse = {
  data: {
    members: Array<{
      memberAddress: string;
    }>;
  };
};

const MEMBER_ADDRESSES_PAGE_SIZE = 400;
const MEMBER_ADDRESSES_MAX_PAGES = 25;
const MEMBER_ADDRESSES_CACHE_TTL_MS = 5 * 60 * 1000;
const MEMBER_ADDRESSES_REQUEST_TIMEOUT_MS = 10 * 1000;

let memberAddressesCache:
  | {
      addresses: string[];
      expiresAt: number;
    }
  | undefined;

export function isSignatureRequestBody(
  value: unknown,
): value is SignatureRequestBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SignatureRequestBody>;
  return typeof candidate.signature === "string";
}

export function isChannelRequestBody(
  value: unknown,
): value is ChannelRequestBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChannelRequestBody>;
  return (
    typeof candidate.signature === "string" &&
    typeof candidate.key === "string" &&
    candidate.key.length > 0 &&
    !candidate.key.endsWith("/")
  );
}

export function logServerError(message: string, error: unknown) {
  if (axios.isAxiosError(error)) {
    console.error(message, {
      code: error.code,
      name: error.name,
      status: error.response?.status,
    });
    return;
  }

  if (error instanceof Error) {
    console.error(message, { name: error.name });
    return;
  }

  console.error(message, { type: typeof error });
}

function isMembersQueryResponse(value: unknown): value is MembersQueryResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = (value as Partial<MembersQueryResponse>).data;
  if (!data || typeof data !== "object" || !Array.isArray(data.members)) {
    return false;
  }

  return data.members.every(
    (member) =>
      member &&
      typeof member === "object" &&
      typeof member.memberAddress === "string",
  );
}

export async function fetchMemberAddresses(): Promise<string[]> {
  const now = Date.now();
  if (memberAddressesCache && memberAddressesCache.expiresAt > now) {
    return memberAddressesCache.addresses;
  }

  const addresses: string[] = [];
  let skip = 0;

  for (let page = 0; page < MEMBER_ADDRESSES_MAX_PAGES; page += 1) {
    const response = await axios.post<unknown>(
      "https://gateway-arbitrum.network.thegraph.com/api/f116eb88884a7cfc10c04aa7e7de7208/subgraphs/id/6x9FK3iuhVFaH9sZ39m8bKB5eckax8sjxooBPNKWWK8r",
      {
        query: `
          query listMembers($skip: Int!, $first: Int!) {
            members(where: { dao: "0xf02fd4286917270cb94fbc13a0f4e1ed76f7e986" }, skip: $skip, first: $first, orderBy: createdAt, orderDirection: desc) {
              memberAddress
            }
          }
        `,
        operationName: "listMembers",
        variables: {
          skip,
          first: MEMBER_ADDRESSES_PAGE_SIZE,
        },
      },
      {
        headers: {
          Origin: "https://admin.daohaus.club",
        },
        timeout: MEMBER_ADDRESSES_REQUEST_TIMEOUT_MS,
      },
    );

    if (!isMembersQueryResponse(response.data)) {
      throw new Error("Invalid member lookup response");
    }

    const members = response.data.data.members;
    addresses.push(
      ...members.map((member) => member.memberAddress.toLowerCase()),
    );

    if (members.length < MEMBER_ADDRESSES_PAGE_SIZE) {
      memberAddressesCache = {
        addresses,
        expiresAt: now + MEMBER_ADDRESSES_CACHE_TTL_MS,
      };

      return addresses;
    }

    skip += MEMBER_ADDRESSES_PAGE_SIZE;
  }

  throw new Error("Member lookup exceeded maximum page count");
}
