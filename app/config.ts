import { S3 } from "@aws-sdk/client-s3";

export const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET,
  THE_GRAPH_API_KEY: process.env.THE_GRAPH_API_KEY,
};

export function getS3Bucket() {
  const bucket = process.env.S3_BUCKET?.trim();

  if (!bucket) {
    throw new Error("S3_BUCKET is not configured.");
  }

  return bucket;
}

const hasS3Key = Boolean(process.env.S3_KEY);
const hasS3Secret = Boolean(process.env.S3_SECRET);

if (hasS3Key !== hasS3Secret) {
  throw new Error("S3_KEY and S3_SECRET must be configured together.");
}

export const s3Client = new S3({
  forcePathStyle: false,
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || undefined,
  credentials:
    hasS3Key && hasS3Secret
      ? {
          accessKeyId: process.env.S3_KEY as string,
          secretAccessKey: process.env.S3_SECRET as string,
        }
      : undefined,
});
