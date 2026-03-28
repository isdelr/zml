import "server-only";

import { extname } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { B2Storage } from "@/convex/b2Storage";
import { toErrorMessage } from "@/lib/errors";
import {
  type MediaAssetKind,
  verifyMediaAccessToken,
} from "@/lib/media/delivery";
import { storageBodyToWebReadableStream } from "@/lib/storage/object-body";

const storage = new B2Storage();
const MEDIA_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

function getFilenameExtension(
  storageKey: string,
  contentType: string | null,
  assetKind: MediaAssetKind,
): string {
  const keyExtension = extname(storageKey);
  if (keyExtension) {
    return keyExtension;
  }

  if (contentType === "audio/mp4") {
    return ".m4a";
  }
  if (contentType === "audio/mpeg") {
    return ".mp3";
  }
  if (contentType === "image/png") {
    return ".png";
  }
  if (contentType === "image/webp") {
    return ".webp";
  }
  if (contentType === "image/gif") {
    return ".gif";
  }

  return assetKind === "audio" ? ".audio" : ".image";
}

function setStandardMediaHeaders(
  headers: Headers,
  input: {
    contentType?: string | null;
    contentLength?: number | null;
    contentRange?: string | null;
    etag?: string | null;
    lastModified?: Date | null;
    disposition?: "inline" | "attachment";
    filename?: string | null;
  },
) {
  headers.set("Cache-Control", MEDIA_CACHE_CONTROL);
  headers.set("CDN-Cache-Control", MEDIA_CACHE_CONTROL);
  headers.set("Cloudflare-CDN-Cache-Control", MEDIA_CACHE_CONTROL);
  headers.set("Accept-Ranges", "bytes");

  if (input.contentType) {
    headers.set("Content-Type", input.contentType);
  }
  if (typeof input.contentLength === "number") {
    headers.set("Content-Length", `${input.contentLength}`);
  }
  if (input.contentRange) {
    headers.set("Content-Range", input.contentRange);
  }
  if (input.etag) {
    headers.set("ETag", input.etag);
  }
  if (input.lastModified) {
    headers.set("Last-Modified", input.lastModified.toUTCString());
  }
  if (input.filename) {
    headers.set(
      "Content-Disposition",
      `${input.disposition ?? "inline"}; filename="${input.filename}"`,
    );
  }
}

async function validateMediaToken(
  request: NextRequest,
  tokenSubjectId: string,
  assetKind: MediaAssetKind,
) {
  const mediaToken = request.nextUrl.searchParams.get("mediaToken");
  if (!mediaToken) {
    return null;
  }

  const payload = await verifyMediaAccessToken(mediaToken);
  if (!payload) {
    return null;
  }

  if (
    payload.submissionId !== tokenSubjectId ||
    payload.assetKind !== assetKind ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  return payload;
}

export async function serveMediaStorageAsset(
  request: NextRequest,
  input: {
    tokenSubjectId: string;
    resourceId: string;
    assetKind: MediaAssetKind;
    disposition?: "inline" | "attachment";
  },
) {
  let tokenPayload: Awaited<ReturnType<typeof validateMediaToken>> | null = null;

  try {
    tokenPayload = await validateMediaToken(
      request,
      input.tokenSubjectId,
      input.assetKind,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to validate media token.",
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  }

  if (!tokenPayload) {
    return NextResponse.json(
      { error: "Missing, invalid, or expired media token." },
      { status: 403 },
    );
  }

  const storageKey = tokenPayload.storageKey;
  const disposition = input.disposition ?? "inline";

  try {
    if (request.method === "HEAD") {
      const headResponse = await storage.headObject(storageKey);
      const headers = new Headers();
      const contentType = headResponse.ContentType ?? null;
      const filename = `${input.resourceId}-${input.assetKind}${getFilenameExtension(
        storageKey,
        contentType,
        input.assetKind,
      )}`;

      setStandardMediaHeaders(headers, {
        contentType,
        contentLength: headResponse.ContentLength ?? null,
        etag: headResponse.ETag ?? null,
        lastModified: headResponse.LastModified ?? null,
        disposition,
        filename,
      });

      return new NextResponse(null, {
        status: headResponse.$metadata.httpStatusCode ?? 200,
        headers,
      });
    }

    const range = request.headers.get("range") ?? undefined;
    const objectResponse = await storage.getObject(storageKey, {
      range,
    });

    if (!objectResponse.Body) {
      return NextResponse.json(
        { error: "Media object body is missing." },
        { status: 502 },
      );
    }

    const headers = new Headers();
    const contentType = objectResponse.ContentType ?? null;
    const filename = `${input.resourceId}-${input.assetKind}${getFilenameExtension(
      storageKey,
      contentType,
      input.assetKind,
    )}`;

    setStandardMediaHeaders(headers, {
      contentType,
      contentLength: objectResponse.ContentLength ?? null,
      contentRange: objectResponse.ContentRange ?? null,
      etag: objectResponse.ETag ?? null,
      lastModified: objectResponse.LastModified ?? null,
      disposition,
      filename,
    });

    const status =
      objectResponse.$metadata.httpStatusCode ??
      (objectResponse.ContentRange ? 206 : 200);

    return new NextResponse(storageBodyToWebReadableStream(objectResponse.Body), {
      status,
      headers,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      typeof (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === "number"
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata!
            .httpStatusCode!
        : 500;

    return NextResponse.json(
      {
        error: "Failed to fetch media object.",
        message: toErrorMessage(error),
      },
      { status: statusCode },
    );
  }
}
