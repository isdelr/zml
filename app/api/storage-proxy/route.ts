import { NextRequest, NextResponse } from "next/server";
import { toErrorMessage } from "@/lib/errors";

const storageEndpoint =
  process.env.B2_ENDPOINT ??
  process.env.R2_ENDPOINT ??
  "https://s3.us-west-004.backblazeb2.com";

function parseEndpoint(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const allowedStorageEndpoint = parseEndpoint(storageEndpoint);

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const encodedUrl = request.nextUrl.searchParams.get("url");
  if (!encodedUrl) {
    return NextResponse.json(
      { error: "Missing required query parameter: url" },
      { status: 400 },
    );
  }

  if (!allowedStorageEndpoint) {
    return NextResponse.json(
      { error: "Invalid server storage endpoint configuration" },
      { status: 500 },
    );
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(encodedUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid url query parameter" },
      { status: 400 },
    );
  }

  if (
    targetUrl.protocol !== allowedStorageEndpoint.protocol ||
    targetUrl.hostname !== allowedStorageEndpoint.hostname
  ) {
    return NextResponse.json({ error: "Target host is not allowed" }, { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch upstream storage object",
        message: toErrorMessage(error, "Unknown error"),
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Upstream storage request failed", status: upstream.status },
      { status: upstream.status },
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");
  const acceptRanges = upstream.headers.get("accept-ranges");
  const etag = upstream.headers.get("etag");
  const lastModified = upstream.headers.get("last-modified");

  headers.set("Cache-Control", "private, no-store");
  if (contentType) headers.set("Content-Type", contentType);
  if (contentLength) headers.set("Content-Length", contentLength);
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
  if (etag) headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
