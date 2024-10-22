import { ListObjectsCommand } from "@aws-sdk/client-s3";
import { verifyMessage } from "ethers";
import { NextResponse } from "next/server";
import { s3Client } from "../../config";
import axios from "axios";

const bucketParams = { Bucket: "raid-guild-valhalla" };

export async function POST(req) {
  const request = await req.json();

  // Verify the message using the provided signature
  const address = verifyMessage(
    "gm raidguild member",
    request.signature.toString()
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
      }
    );

    const members = response.data.data.members.map((member) =>
      member.memberAddress.toLowerCase()
    );

    if (members.includes(address.toLowerCase())) {
      const data = await s3Client.send(new ListObjectsCommand(bucketParams));
      console.log({ data });
      return NextResponse.json({ response: data.Contents });
    } else {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json({ error: "An error occurred." }, { status: 500 });
  }
}
