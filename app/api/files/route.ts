import {
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  type _Object,
} from "@aws-sdk/client-s3";
import { verifyMessage } from "ethers";
import { NextResponse } from "next/server";
import { s3Client } from "../../config";
import {
  MEMBER_SIGN_MESSAGE,
  NOT_MEMBER_ERROR,
  type SignatureRequestBody,
  fetchMemberAddresses,
  isSignatureRequestBody,
  logServerError,
} from "../shared/memberAuth";

const bucketParams = { Bucket: "raid-guild-valhalla" };

type ValhallaFile = {
  Key: string;
};

function toValhallaFiles(contents: _Object[]): ValhallaFile[] {
  return contents.flatMap((file) =>
    file.Key && !file.Key.endsWith("/") ? [{ Key: file.Key }] : [],
  );
}

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
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let address: string;

  try {
    address = verifyMessage(MEMBER_SIGN_MESSAGE, requestBody.signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const members = await fetchMemberAddresses();

    if (members.includes(address.toLowerCase())) {
      const contents: _Object[] = [];
      let continuationToken: string | undefined;

      do {
        const data: ListObjectsV2CommandOutput = await s3Client.send(
          new ListObjectsV2Command({
            ...bucketParams,
            ContinuationToken: continuationToken,
          }),
        );

        contents.push(...(data.Contents ?? []));
        continuationToken = data.NextContinuationToken;
      } while (continuationToken);

      return NextResponse.json({ response: toValhallaFiles(contents) });
    } else {
      return NextResponse.json({ error: NOT_MEMBER_ERROR }, { status: 403 });
    }
  } catch (error: unknown) {
    logServerError("Error fetching files", error);
    return NextResponse.json({ error: "An error occurred." }, { status: 500 });
  }
}
