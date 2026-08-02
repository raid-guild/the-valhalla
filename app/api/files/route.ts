import {
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getS3Bucket, s3Client } from "../../config";
import {
  MemberSessionError,
  logServerError,
  requireMemberSession,
} from "../shared/memberAuth";

const S3_LIST_PAGE_SIZE = 500;
const S3_LIST_MAX_PAGES = 10;
const S3_LIST_MAX_FILES = S3_LIST_PAGE_SIZE * S3_LIST_MAX_PAGES;

type ValhallaFile = {
  Key: string;
};

function addValhallaFiles(
  files: ValhallaFile[],
  contents: ListObjectsV2CommandOutput["Contents"],
) {
  for (const file of contents ?? []) {
    if (!file.Key || file.Key.endsWith("/")) {
      continue;
    }

    if (files.length >= S3_LIST_MAX_FILES) {
      throw new Error("S3 file listing exceeded maximum file count");
    }

    files.push({ Key: file.Key });
  }
}

export async function POST() {
  try {
    await requireMemberSession();

    const bucketParams = { Bucket: getS3Bucket() };
    const files: ValhallaFile[] = [];
    let continuationToken: string | undefined;
    let pagesFetched = 0;

    do {
      if (pagesFetched >= S3_LIST_MAX_PAGES) {
        throw new Error("S3 file listing exceeded maximum page count");
      }

      const data: ListObjectsV2CommandOutput = await s3Client.send(
        new ListObjectsV2Command({
          ...bucketParams,
          MaxKeys: S3_LIST_PAGE_SIZE,
          ContinuationToken: continuationToken,
        }),
      );

      pagesFetched += 1;
      addValhallaFiles(files, data.Contents);
      continuationToken = data.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json({ response: files });
  } catch (error: unknown) {
    if (error instanceof MemberSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logServerError("Error fetching files", error);
    return NextResponse.json({ error: "An error occurred." }, { status: 500 });
  }
}
