import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";

import { getS3Bucket, s3Client } from "../../config";
import { readByteStream } from "./boundedStream";
import { isArchivedHtmlChannel } from "./channelArchive";
import { parseChannelTranscript } from "./channelTranscriptParser";

const MAX_CHANNEL_OBJECT_BYTES = 8 * 1024 * 1024;

export class ChannelObjectTooLargeError extends Error {
  constructor() {
    super("This channel export is too large for single-channel chat.");
    this.name = "ChannelObjectTooLargeError";
  }
}

export class ChannelNotFoundError extends Error {
  constructor() {
    super("This channel is not part of the archived HTML collection.");
    this.name = "ChannelNotFoundError";
  }
}

export async function getChannelTranscript(key: string, signal: AbortSignal) {
  const archiveSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);

  if (!(await isArchivedHtmlChannel(key, archiveSignal))) {
    throw new ChannelNotFoundError();
  }

  const object = await s3Client.send(
    new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
    }),
    { abortSignal: archiveSignal },
  );

  if (!object.Body) {
    throw new Error("Channel object did not include a response body");
  }

  const bodyStream = object.Body.transformToWebStream();
  if ((object.ContentLength ?? 0) > MAX_CHANNEL_OBJECT_BYTES) {
    await bodyStream.cancel().catch(() => undefined);
    throw new ChannelObjectTooLargeError();
  }

  const bytes = await readByteStream(
    bodyStream,
    MAX_CHANNEL_OBJECT_BYTES,
    () => new ChannelObjectTooLargeError(),
    {
      createTimeoutError: () => new Error("Channel archive read timed out"),
      timeoutMs: 20_000,
    },
  );
  const html = new TextDecoder().decode(bytes);

  return parseChannelTranscript(html);
}
