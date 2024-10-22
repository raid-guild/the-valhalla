import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { JsonRpcProvider, Interface, Contract, verifyMessage } from "ethers";
import { NextResponse } from "next/server";
import axios from "axios";

import { s3Client } from "../../config";

export async function POST(req) {
  let request;

  try {
    request = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = verifyMessage(
    "gm raidguild member",
    request.signature.toString(),
  );

  try {
    // Make the request to the GraphQL API
    const response = await axios.post(
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

    const members = response.data.data.members.map((member) =>
      member.memberAddress.toLowerCase(),
    );

    if (members.includes(address.toLowerCase())) {
      const bucketParams = {
        Bucket: "raid-guild-valhalla",
        Key: request.key,
      };

      const url = await getSignedUrl(
        s3Client,
        new GetObjectCommand(bucketParams),
        {
          expiresIn: 15 * 60,
        },
      );

      return NextResponse.json({ channel: url });
    } else {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
