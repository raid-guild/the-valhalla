import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { getS3Bucket, s3Client } from "../../config";
import { isArchivedHtmlChannel } from "../shared/channelArchive";
import {
  type ChannelRequestBody,
  isChannelRequestBody,
  logServerError,
  memberSessionErrorResponse,
  requireMemberSession,
} from "../shared/memberAuth";
import { getSameOrigin } from "../shared/session";

export async function POST(req: Request) {
  if (!getSameOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await requireMemberSession();
  } catch (error: unknown) {
    const sessionErrorResponse = memberSessionErrorResponse(error);
    if (sessionErrorResponse) return sessionErrorResponse;

    logServerError("Error authorizing channel request", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let requestBody: ChannelRequestBody;

  try {
    const parsed = (await req.json()) as unknown;
    if (!isChannelRequestBody(parsed)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    requestBody = parsed;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (!(await isArchivedHtmlChannel(requestBody.key, req.signal))) {
      return NextResponse.json(
        { error: "This channel is not part of the archived HTML collection." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const bucketParams = {
      Bucket: getS3Bucket(),
      Key: requestBody.key,
      ResponseCacheControl: "private, no-store",
    };

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand(bucketParams),
      {
        expiresIn: 15 * 60,
      },
    );

    return NextResponse.json(
      { channel: url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    logServerError("Error fetching channel", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
