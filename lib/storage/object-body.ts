import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

type WebStreamConvertible = {
  transformToWebStream?: () => ReadableStream<Uint8Array>;
};

function toUint8Array(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }

  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }

  if (typeof chunk === "string") {
    return new TextEncoder().encode(chunk);
  }

  throw new Error("Unsupported stream chunk type.");
}

function createCancelAwareReadableStream(
  source: AsyncIterable<unknown>,
  onCancel?: (reason: unknown) => void,
): ReadableStream<Uint8Array> {
  const iterator = source[Symbol.asyncIterator]();
  let finished = false;

  const finish = async (reason?: unknown) => {
    if (finished) {
      return;
    }

    finished = true;

    try {
      await iterator.return?.();
    } catch {
      // Ignore iterator cleanup failures during shutdown/cancel.
    }

    onCancel?.(reason);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) {
        return;
      }

      try {
        const { done, value } = await iterator.next();

        if (finished) {
          return;
        }

        if (done) {
          finished = true;
          controller.close();
          return;
        }

        controller.enqueue(toUint8Array(value));
      } catch (error) {
        if (finished) {
          return;
        }

        finished = true;
        controller.error(error);
      }
    },
    async cancel(reason) {
      await finish(reason);
    },
  });
}

export function storageBodyToNodeReadable(body: unknown): Readable {
  if (body instanceof Readable) {
    return body;
  }

  if (
    body &&
    typeof body === "object" &&
    "transformToWebStream" in body &&
    typeof (body as WebStreamConvertible).transformToWebStream === "function"
  ) {
    return Readable.fromWeb(
      (body as WebStreamConvertible).transformToWebStream!() as NodeReadableStream<Uint8Array>,
    );
  }

  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    return Readable.from(body as AsyncIterable<Uint8Array>);
  }

  throw new Error("Unsupported storage object body.");
}

export function storageBodyToWebReadableStream(
  body: unknown,
): ReadableStream<Uint8Array> {
  if (body instanceof Readable) {
    return createCancelAwareReadableStream(body, (reason) => {
      if (!body.destroyed) {
        body.destroy(reason instanceof Error ? reason : undefined);
      }
    });
  }

  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    return createCancelAwareReadableStream(body as AsyncIterable<Uint8Array>);
  }

  if (
    body &&
    typeof body === "object" &&
    "transformToWebStream" in body &&
    typeof (body as WebStreamConvertible).transformToWebStream === "function"
  ) {
    return (body as WebStreamConvertible).transformToWebStream!();
  }

  throw new Error("Unsupported storage object body.");
}
