import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

type WebStreamConvertible = {
  transformToWebStream?: () => ReadableStream<Uint8Array>;
};

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
  if (
    body &&
    typeof body === "object" &&
    "transformToWebStream" in body &&
    typeof (body as WebStreamConvertible).transformToWebStream === "function"
  ) {
    return (body as WebStreamConvertible).transformToWebStream!();
  }

  return Readable.toWeb(
    storageBodyToNodeReadable(body),
  ) as ReadableStream<Uint8Array>;
}
