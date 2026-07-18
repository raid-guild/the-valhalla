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
    typeof candidate.signature === "string" && typeof candidate.key === "string"
  );
}

export async function fetchMemberAddresses(): Promise<string[]> {
  const response = await axios.post<MembersQueryResponse>(
    "https://gateway-arbitrum.network.thegraph.com/api/f116eb88884a7cfc10c04aa7e7de7208/subgraphs/id/6x9FK3iuhVFaH9sZ39m8bKB5eckax8sjxooBPNKWWK8r",
    {
      query: `
        query listMembers {
          members(where: { dao: "0xf02fd4286917270cb94fbc13a0f4e1ed76f7e986" }, skip: 0, first: 400, orderBy: createdAt, orderDirection: desc) {
            memberAddress
          }
        }
      `,
      operationName: "listMembers",
    },
    {
      headers: {
        Origin: "https://admin.daohaus.club",
      },
    },
  );

  return response.data.data.members.map((member) =>
    member.memberAddress.toLowerCase(),
  );
}
