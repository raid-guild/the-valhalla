import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { JsonRpcProvider, Interface, Contract, verifyMessage } from "ethers";
import { NextResponse } from "next/server";

import { s3Client } from "../../config";

export async function POST(req, res) {
  let request = await req.json();

  const address = verifyMessage(
    "gm raidguild member",
    request.signature.toString()
  );

  const abi = new Interface([
    "function members(address account) view returns (address, uint256, uint256, bool, uint256, uint256)",
  ]);
  const contract = new Contract(
    "0xfe1084bc16427e5eb7f13fc19bcd4e641f7d571f",
    abi,
    new JsonRpcProvider("https://rpc.ankr.com/gnosis")
  );

  const member = await contract.members(address);

  if (member[3]) {
    const bucketParams = {
      Bucket: "raid-guild-valhalla",
      Key: request.key,
    };

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand(bucketParams),
      {
        expiresIn: 15 * 60,
      }
    );

    return NextResponse.json({ channel: url });
  }
}
