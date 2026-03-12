import { getToken } from "@convex-dev/better-auth/utils";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { B2Storage } from "@/convex/b2Storage";
import { firstNonEmpty } from "@/lib/env";
import { toErrorMessage } from "@/lib/errors";

const storage = new B2Storage();
const convexSiteUrl = firstNonEmpty(
  process.env.CONVEX_SITE_URL,
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  "http://localhost:3211",
)!;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { token } = await getToken(convexSiteUrl, request.headers);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key")?.trim();
  if (!key) {
    return NextResponse.json({ error: "Missing storage key." }, { status: 400 });
  }

  if (!request.body) {
    return NextResponse.json({ error: "Missing file body." }, { status: 400 });
  }

  try {
    const bodyStream = Readable.fromWeb(
      request.body as unknown as NodeReadableStream<Uint8Array>,
    );
    const contentLengthHeader = request.headers.get("content-length");
    const parsedContentLength = contentLengthHeader
      ? Number.parseInt(contentLengthHeader, 10)
      : Number.NaN;

    await storage.putObject(key, bodyStream, {
      contentType:
        request.headers.get("content-type") || "application/octet-stream",
      contentLength:
        Number.isFinite(parsedContentLength) && parsedContentLength > 0
          ? parsedContentLength
          : undefined,
    });
    return NextResponse.json({ key });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to upload file.",
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
