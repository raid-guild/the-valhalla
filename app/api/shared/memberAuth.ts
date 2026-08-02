import axios from "axios";
import { CONFIG } from "../../config";
import { readSessionAddress } from "./session";

export const NOT_MEMBER_ERROR =
  "This wallet does not hold at least 100 RaidGuild shares.";

export type ChannelRequestBody = {
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
const MEMBERSHIP_MIN_SHARES = "100000000000000000000";
const MEMBERS_SUBGRAPH_ID = "6x9FK3iuhVFaH9sZ39m8bKB5eckax8sjxooBPNKWWK8r";
const URL_PATTERN = /https?:\/\/\S+/g;

let memberAddressesCache:
  | {
      addresses: string[];
      expiresAt: number;
    }
  | undefined;

export function isChannelRequestBody(
  value: unknown,
): value is ChannelRequestBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChannelRequestBody>;
  return (
    typeof candidate.key === "string" &&
    candidate.key.length > 0 &&
    !candidate.key.endsWith("/")
  );
}

export function logServerError(message: string, error: unknown) {
  if (axios.isAxiosError(error)) {
    console.error(message, {
      code: error.code,
      message: sanitizeLogMessage(error.message),
      name: error.name,
      status: error.response?.status,
    });
    return;
  }

  if (error instanceof Error) {
    console.error(message, {
      message: sanitizeLogMessage(error.message),
      name: error.name,
    });
    return;
  }

  console.error(message, { type: typeof error });
}

function sanitizeLogMessage(message: string) {
  return message.replace(URL_PATTERN, "[redacted-url]");
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

  if (!CONFIG.THE_GRAPH_API_KEY) {
    throw new Error("THE_GRAPH_API_KEY is not configured");
  }

  const memberSubgraphUrl = `https://gateway-arbitrum.network.thegraph.com/api/${CONFIG.THE_GRAPH_API_KEY}/subgraphs/id/${MEMBERS_SUBGRAPH_ID}`;

  for (let page = 0; page < MEMBER_ADDRESSES_MAX_PAGES; page += 1) {
    const response = await axios.post<unknown>(
      memberSubgraphUrl,
      {
        query: `
          query listMembers($skip: Int!, $first: Int!, $minimumShares: BigInt!) {
            members(where: { dao: "0xf02fd4286917270cb94fbc13a0f4e1ed76f7e986", shares_gte: $minimumShares }, skip: $skip, first: $first, orderBy: createdAt, orderDirection: desc) {
              memberAddress
            }
          }
        `,
        operationName: "listMembers",
        variables: {
          skip,
          first: MEMBER_ADDRESSES_PAGE_SIZE,
          minimumShares: MEMBERSHIP_MIN_SHARES,
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
        expiresAt: Date.now() + MEMBER_ADDRESSES_CACHE_TTL_MS,
      };

      return addresses;
    }

    skip += MEMBER_ADDRESSES_PAGE_SIZE;
  }

  throw new Error("Member lookup exceeded maximum page count");
}

export async function isEligibleMemberAddress(address: string) {
  const members = await fetchMemberAddresses();
  return members.includes(address.toLowerCase());
}

export class MemberSessionError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "MemberSessionError";
  }
}

export async function requireMemberSession() {
  const address = await readSessionAddress();
  if (!address) {
    throw new MemberSessionError("Authentication required.", 401);
  }

  if (!(await isEligibleMemberAddress(address))) {
    throw new MemberSessionError(NOT_MEMBER_ERROR, 403);
  }

  return address;
}
