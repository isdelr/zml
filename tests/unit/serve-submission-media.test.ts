import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getObjectMock = vi.fn();
const headObjectMock = vi.fn();
const verifyMediaAccessTokenMock = vi.fn();

vi.mock("@/convex/b2Storage", () => ({
  B2Storage: class {
    getObject = getObjectMock;
    headObject = headObjectMock;
  },
}));

vi.mock("@/lib/media/delivery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/media/delivery")>(
    "@/lib/media/delivery",
  );

  return {
    ...actual,
    verifyMediaAccessToken: verifyMediaAccessTokenMock,
  };
});

describe("serveMediaStorageAsset", () => {
  beforeEach(() => {
    vi.resetModules();
    getObjectMock.mockReset();
    headObjectMock.mockReset();
    verifyMediaAccessTokenMock.mockReset();
  });

  it("keeps public inline artwork cacheable", async () => {
    headObjectMock.mockResolvedValue({
      ContentType: "image/webp",
      ContentLength: 123,
      ETag: '"etag-art"',
      LastModified: new Date("2026-03-28T12:00:00Z"),
      $metadata: { httpStatusCode: 200 },
    });

    const { serveMediaStorageKey } = await import(
      "@/lib/media/serve-submission-media"
    );
    const response = await serveMediaStorageKey(
      new NextRequest(
        "http://localhost/api/media/submissions/submission-1/art",
        { method: "HEAD" },
      ),
      {
        storageKey: "submissions/art/test.webp",
        resourceId: "submission-1",
        assetKind: "art",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(response.headers.get("Vary")).toBe("Range");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
  });

  it("marks audio responses as no-store so range requests are not edge-cached", async () => {
    verifyMediaAccessTokenMock.mockResolvedValue({
      v: 1,
      submissionId: "submission-1",
      assetKind: "audio",
      storageKey: "submissions/audio/test.mp3",
      scope: "public",
      expiresAt: Date.now() + 60_000,
    });
    getObjectMock.mockResolvedValue({
      Body: Readable.from([Buffer.from("audio")]),
      ContentType: "audio/mpeg",
      ContentLength: 5,
      ContentRange: "bytes 0-4/10",
      $metadata: { httpStatusCode: 206 },
    });

    const { serveMediaStorageAsset } = await import(
      "@/lib/media/serve-submission-media"
    );
    const response = await serveMediaStorageAsset(
      new NextRequest(
        "http://localhost/api/media/submissions/submission-1/audio?mediaToken=test",
        {
          headers: {
            range: "bytes=0-4",
          },
        },
      ),
      {
        tokenSubjectId: "submission-1",
        resourceId: "submission-1",
        assetKind: "audio",
      },
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("CDN-Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "private, no-store",
    );
    expect(response.headers.get("Vary")).toBe("Range");
  });

  it("keeps inline artwork cacheable without a media token", async () => {
    headObjectMock.mockResolvedValue({
      ContentType: "image/webp",
      ContentLength: 123,
      $metadata: { httpStatusCode: 200 },
    });

    const { serveMediaStorageKey } = await import(
      "@/lib/media/serve-submission-media"
    );
    const response = await serveMediaStorageKey(
      new NextRequest(
        "http://localhost/api/media/submissions/submission-1/art",
        { method: "HEAD" },
      ),
      {
        storageKey: "submissions/art/private.webp",
        resourceId: "submission-1",
        assetKind: "art",
      },
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
  });
});
