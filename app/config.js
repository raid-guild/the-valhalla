import { S3 } from '@aws-sdk/client-s3';

export const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET
};

export const s3Client = new S3({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET
  }
});
