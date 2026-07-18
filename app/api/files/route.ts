import { ListObjectsCommand } from "@aws-sdk/client-s3";
import { verifyMessage } from "ethers";
import { NextResponse } from "next/server";
import { s3Client } from "../../config";
import {
  MEMBER_SIGN_MESSAGE,
  NOT_MEMBER_ERROR,
  type SignatureRequestBody,
  fetchMemberAddresses,
  isSignatureRequestBody,
} from "../shared/memberAuth";

const bucketParams = { Bucket: "raid-guild-valhalla" };

export async function POST(req: Request) {
  let requestBody: SignatureRequestBody;

  try {
    const parsed = (await req.json()) as unknown;
    if (!isSignatureRequestBody(parsed)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    requestBody = parsed;
  } catch (error: unknown) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify the message using the provided signature
  const address = verifyMessage(MEMBER_SIGN_MESSAGE, requestBody.signature);

  try {
    const members = await fetchMemberAddresses();

    if (members.includes(address.toLowerCase())) {
      const data = await s3Client.send(new ListObjectsCommand(bucketParams));
      return NextResponse.json({ response: data.Contents });
    } else {
      return NextResponse.json({ error: NOT_MEMBER_ERROR }, { status: 403 });
    }
  } catch (error: unknown) {
    console.error("Error fetching files:", error);
    return NextResponse.json({ error: "An error occurred." }, { status: 500 });
  }
}
