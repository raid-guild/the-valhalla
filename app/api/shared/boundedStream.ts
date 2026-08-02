import "server-only";

export async function readByteStream(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  createTooLargeError: () => Error,
  options?: {
    createTimeoutError: () => Error;
    timeoutMs: number;
  },
) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let timedOut = false;
  const timeoutId = options
    ? setTimeout(() => {
        timedOut = true;
        void reader.cancel();
      }, options.timeoutMs)
    : undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw createTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    reader.releaseLock();
  }

  if (timedOut && options) throw options.createTimeoutError();

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}
