import { S3 } from "@aws-sdk/client-s3";

export const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET,
};

export const s3Client = new S3({
  forcePathStyle: false,
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || undefined,
  credentials:
    process.env.S3_KEY && process.env.S3_SECRET
      ? {
          accessKeyId: process.env.S3_KEY,
          secretAccessKey: process.env.S3_SECRET,
        }
      : undefined,
});
