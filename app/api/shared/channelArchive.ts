import "server-only";

import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { getS3Bucket, s3Client } from "../../config";

export async function isArchivedHtmlChannel(key: string, signal: AbortSignal) {
  if (!key.toLowerCase().endsWith(".html")) return false;

  const result = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: getS3Bucket(),
      MaxKeys: 2,
      Prefix: key,
    }),
    { abortSignal: signal },
  );

  return Boolean(
    result.Contents?.some(
      (object) => object.Key === key && !object.Key.endsWith("/"),
    ),
  );
}
