import { Readable } from "node:stream";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getTokenMock = vi.fn();
const putObjectMock = vi.fn();
const createMultipartUploadMock = vi.fn();
const uploadPartMock = vi.fn();
const completeMultipartUploadMock = vi.fn();
const abortMultipartUploadMock = vi.fn();

vi.mock("@convex-dev/better-auth/utils", () => ({
  getToken: getTokenMock,
}));

vi.mock("@/convex/b2Storage", () => ({
  B2Storage: class {
    putObject = putObjectMock;
    createMultipartUpload = createMultipartUploadMock;
    uploadPart = uploadPartMock;
    completeMultipartUpload = completeMultipartUploadMock;
    abortMultipartUpload = abortMultipartUploadMock;
  },
}));

describe("storage upload route", () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    putObjectMock.mockReset();
    createMultipartUploadMock.mockReset();
    uploadPartMock.mockReset();
    completeMultipartUploadMock.mockReset();
    abortMultipartUploadMock.mockReset();
  });

  it("rejects unauthenticated uploads", async () => {
    getTokenMock.mockResolvedValue({ token: null });

    const { POST } = await import("@/app/api/storage/upload-file/route");
    const response = await POST(
      new Request("http://localhost/api/storage/upload-file?key=test-key", {
        method: "POST",
        body: "hello",
      }),
    );

    expect(response.status).toBe(401);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("streams the request body to storage", async () => {
    getTokenMock.mockResolvedValue({ token: "session-token" });

    let uploadedBody = "";
    putObjectMock.mockImplementation(
      async (
        key: string,
        body: Readable,
        options?: { contentType?: string; contentLength?: number },
      ) => {
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        uploadedBody = Buffer.concat(chunks).toString("utf8");

        expect(key).toBe("test-key");
        expect(options).toEqual({
          contentType: "audio/flac",
          contentLength: 11,
        });
      },
    );

    const { POST } = await import("@/app/api/storage/upload-file/route");
    const response = await POST(
      new Request("http://localhost/api/storage/upload-file?key=test-key", {
        method: "POST",
        headers: {
          "content-type": "audio/flac",
          "content-length": "11",
        },
        body: "hello world",
      }),
    );

    expect(response.status).toBe(200);
    expect(uploadedBody).toBe("hello world");
    await expect(response.json()).resolves.toEqual({ key: "test-key" });
  });

  it("starts multipart uploads", async () => {
    getTokenMock.mockResolvedValue({ token: "session-token" });
    createMultipartUploadMock.mockResolvedValue({ uploadId: "upload-123" });

    const { POST } = await import("@/app/api/storage/upload-file/route");
    const response = await POST(
      new Request(
        "http://localhost/api/storage/upload-file?action=multipart-start&key=test-key",
        {
          method: "POST",
          headers: {
            "content-type": "audio/flac",
          },
        },
      ),
    );

    expect(createMultipartUploadMock).toHaveBeenCalledWith("test-key", {
      contentType: "audio/flac",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      key: "test-key",
      uploadId: "upload-123",
    });
  });

  it("uploads multipart chunks", async () => {
    getTokenMock.mockResolvedValue({ token: "session-token" });

    let uploadedBody = "";
    uploadPartMock.mockImplementation(
      async (
        key: string,
        uploadId: string,
        partNumber: number,
        body: Readable,
        options?: { contentLength?: number },
      ) => {
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        uploadedBody = Buffer.concat(chunks).toString("utf8");

        expect(key).toBe("test-key");
        expect(uploadId).toBe("upload-123");
        expect(partNumber).toBe(3);
        expect(options).toEqual({ contentLength: 4 });

        return { etag: '"etag-3"' };
      },
    );

    const { POST } = await import("@/app/api/storage/upload-file/route");
    const response = await POST(
      new Request(
        "http://localhost/api/storage/upload-file?action=multipart-part&key=test-key&uploadId=upload-123&partNumber=3",
        {
          method: "POST",
          headers: {
            "content-type": "audio/flac",
            "content-length": "4",
          },
          body: "part",
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(uploadedBody).toBe("part");
    await expect(response.json()).resolves.toEqual({
      key: "test-key",
      uploadId: "upload-123",
      partNumber: 3,
      etag: '"etag-3"',
    });
  });
});
