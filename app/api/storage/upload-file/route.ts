import { getToken } from "@convex-dev/better-auth/utils";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { B2Storage } from "@/convex/b2Storage";
import { firstNonEmpty } from "@/lib/env";
import { toErrorMessage } from "@/lib/errors";
import { captureServerException } from "@/lib/observability/server";

const storage = new B2Storage();
const ALLOWED_UPLOAD_KEY_PREFIXES = ["uploads/submissions/", "rounds/images/"];
const convexSiteUrl = firstNonEmpty(
  process.env.CONVEX_SITE_URL,
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  "http://localhost:3211",
)!;

export const runtime = "nodejs";

function getRequestKey(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("key")?.trim() ?? "";
}

function getRequestAction(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("action")?.trim() ?? "upload";
}

function isAllowedManagedUploadKey(key: string) {
  return ALLOWED_UPLOAD_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function getContentLength(request: Request) {
  const contentLengthHeader = request.headers.get("content-length");
  const parsedContentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN;

  return Number.isFinite(parsedContentLength) && parsedContentLength > 0
    ? parsedContentLength
    : undefined;
}

async function requireAuthenticated(request: Request) {
  const { token } = await getToken(convexSiteUrl, request.headers);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  return null;
}

async function handleSingleUpload(request: Request, key: string) {
  if (!request.body) {
    return NextResponse.json({ error: "Missing file body." }, { status: 400 });
  }

  const bodyStream = Readable.fromWeb(
    request.body as unknown as NodeReadableStream<Uint8Array>,
  );

  await storage.putObject(key, bodyStream, {
    contentType:
      request.headers.get("content-type") || "application/octet-stream",
    contentLength: getContentLength(request),
  });

  return NextResponse.json({ key });
}

async function handleMultipartStart(request: Request, key: string) {
  const { uploadId } = await storage.createMultipartUpload(key, {
    contentType:
      request.headers.get("content-type") || "application/octet-stream",
  });

  return NextResponse.json({ key, uploadId });
}

async function handleMultipartPart(request: Request, key: string) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId")?.trim();
  const partNumber = Number.parseInt(
    url.searchParams.get("partNumber") ?? "",
    10,
  );

  if (!uploadId) {
    return NextResponse.json(
      { error: "Missing multipart upload ID." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(partNumber) || partNumber <= 0) {
    return NextResponse.json(
      { error: "Invalid multipart part number." },
      { status: 400 },
    );
  }
  if (!request.body) {
    return NextResponse.json({ error: "Missing part body." }, { status: 400 });
  }

  const bodyStream = Readable.fromWeb(
    request.body as unknown as NodeReadableStream<Uint8Array>,
  );
  const { etag } = await storage.uploadPart(key, uploadId, partNumber, bodyStream, {
    contentLength: getContentLength(request),
  });

  return NextResponse.json({ key, uploadId, partNumber, etag });
}

type CompleteMultipartUploadPayload = {
  parts?: Array<{ partNumber?: number; etag?: string }>;
};

async function handleMultipartComplete(request: Request, key: string) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId")?.trim();
  if (!uploadId) {
    return NextResponse.json(
      { error: "Missing multipart upload ID." },
      { status: 400 },
    );
  }

  let payload: CompleteMultipartUploadPayload;
  try {
    payload = (await request.json()) as CompleteMultipartUploadPayload;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid multipart completion payload.",
        message: toErrorMessage(error),
      },
      { status: 400 },
    );
  }

  const parts = (payload.parts ?? []).filter(
    (part): part is { partNumber: number; etag: string } =>
      Number.isInteger(part.partNumber) &&
      typeof part.etag === "string" &&
      part.etag.length > 0,
  );

  if (parts.length === 0) {
    return NextResponse.json(
      { error: "Missing multipart upload parts." },
      { status: 400 },
    );
  }

  await storage.completeMultipartUpload(key, uploadId, parts);
  return NextResponse.json({ key, uploadId });
}

async function handleMultipartAbort(request: Request, key: string) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId")?.trim();
  if (!uploadId) {
    return NextResponse.json(
      { error: "Missing multipart upload ID." },
      { status: 400 },
    );
  }

  await storage.abortMultipartUpload(key, uploadId);
  return NextResponse.json({ key, uploadId });
}

async function handleRequest(request: Request) {
  const authError = await requireAuthenticated(request);
  if (authError) {
    return authError;
  }

  const key = getRequestKey(request);
  if (!key) {
    return NextResponse.json({ error: "Missing storage key." }, { status: 400 });
  }
  if (!isAllowedManagedUploadKey(key)) {
    return NextResponse.json(
      { error: "Storage key is not allowed for app-managed uploads." },
      { status: 400 },
    );
  }

  const action = getRequestAction(request);

  try {
    switch (action) {
      case "multipart-start":
        return await handleMultipartStart(request, key);
      case "multipart-part":
        return await handleMultipartPart(request, key);
      case "multipart-complete":
        return await handleMultipartComplete(request, key);
      case "multipart-abort":
        return await handleMultipartAbort(request, key);
      case "upload":
      default:
        return await handleSingleUpload(request, key);
    }
  } catch (error) {
    captureServerException(error, {
      tags: {
        route: "/api/storage/upload-file",
        action,
      },
      extras: {
        key,
      },
    });
    return NextResponse.json(
      {
        error: "Failed to upload file.",
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleRequest(request);
}

export async function PUT(request: Request) {
  return handleRequest(request);
}
