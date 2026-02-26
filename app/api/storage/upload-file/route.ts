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
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to parse upload payload.",
        message: toErrorMessage(error),
      },
      { status: 400 },
    );
  }

  const key = formData.get("key");
  if (typeof key !== "string" || key.trim().length === 0) {
    return NextResponse.json({ error: "Missing storage key." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  try {
    const bodyStream = Readable.fromWeb(
      file.stream() as unknown as NodeReadableStream<Uint8Array>,
    );
    await storage.putObject(key, bodyStream, {
      contentType: file.type || "application/octet-stream",
      contentLength: file.size,
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

