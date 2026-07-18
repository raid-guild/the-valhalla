import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { verifyMessage } from "ethers";
import { NextResponse } from "next/server";

import { s3Client } from "../../config";
import {
  MEMBER_SIGN_MESSAGE,
  NOT_MEMBER_ERROR,
  type ChannelRequestBody,
  fetchMemberAddresses,
  isChannelRequestBody,
} from "../shared/memberAuth";

export async function POST(req: Request) {
  let requestBody: ChannelRequestBody;

  try {
    const parsed = (await req.json()) as unknown;
    if (!isChannelRequestBody(parsed)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    requestBody = parsed;
  } catch (error: unknown) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = verifyMessage(MEMBER_SIGN_MESSAGE, requestBody.signature);

  try {
    const members = await fetchMemberAddresses();

    if (members.includes(address.toLowerCase())) {
      const bucketParams = {
        Bucket: "raid-guild-valhalla",
        Key: requestBody.key,
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
      return NextResponse.json({ error: NOT_MEMBER_ERROR }, { status: 403 });
    }
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
