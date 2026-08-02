import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { getS3Bucket, s3Client } from "../../config";
import {
  MemberSessionError,
  type ChannelRequestBody,
  isChannelRequestBody,
  logServerError,
  requireMemberSession,
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
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await requireMemberSession();

    const bucketParams = {
      Bucket: getS3Bucket(),
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
  } catch (error: unknown) {
    if (error instanceof MemberSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logServerError("Error fetching channel", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
