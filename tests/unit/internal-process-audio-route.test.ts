import { beforeEach, describe, expect, it, vi } from "vitest";

const getObjectMock = vi.fn();
const putObjectMock = vi.fn();

vi.mock("@/convex/b2Storage", () => ({
  B2Storage: class {
    getObject = getObjectMock;
    putObject = putObjectMock;
  },
}));

describe("internal submission audio route", () => {
  beforeEach(() => {
    vi.resetModules();
    getObjectMock.mockReset();
    putObjectMock.mockReset();
    process.env.SUBMISSION_PROCESSING_SECRET = "submission-secret";
  });

  it("rejects callers without the processing secret", async () => {
    const { POST } = await import("@/app/api/internal/submissions/process-audio/route");
    const response = await POST(
      new Request("http://localhost/api/internal/submissions/process-audio", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ songFileKey: "uploads/submissions/test.opus" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(putObjectMock).not.toHaveBeenCalled();
  });
});
