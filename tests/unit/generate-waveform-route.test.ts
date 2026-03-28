import { beforeEach, describe, expect, it, vi } from "vitest";

const getTokenMock = vi.fn();
const setAuthMock = vi.fn();
const queryMock = vi.fn();
const mutationMock = vi.fn();
const getObjectMock = vi.fn();
const verifyMediaAccessTokenMock = vi.fn();
const generateWaveformJsonFromAudioFileMock = vi.fn();

vi.mock("@convex-dev/better-auth/utils", () => ({
  getToken: getTokenMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth(value: string) {
      setAuthMock(value);
    }

    query = queryMock;
    mutation = mutationMock;
  },
}));

vi.mock("@/convex/b2Storage", () => ({
  B2Storage: class {
    getObject = getObjectMock;
  },
}));

vi.mock("@/lib/media/delivery", () => ({
  verifyMediaAccessToken: verifyMediaAccessTokenMock,
}));

vi.mock("@/lib/submission/server-waveform", () => ({
  generateWaveformJsonFromAudioFile: generateWaveformJsonFromAudioFileMock,
}));

describe("generate waveform route", () => {
  beforeEach(() => {
    vi.resetModules();
    getTokenMock.mockReset();
    setAuthMock.mockReset();
    queryMock.mockReset();
    mutationMock.mockReset();
    getObjectMock.mockReset();
    verifyMediaAccessTokenMock.mockReset();
    generateWaveformJsonFromAudioFileMock.mockReset();
    process.env.CONVEX_SELF_HOSTED_URL = "http://localhost:3210";
    process.env.CONVEX_SITE_URL = "http://localhost:3211";
  });

  it("rejects unauthenticated callers", async () => {
    getTokenMock.mockResolvedValue({ token: undefined });

    const { POST } = await import("@/app/api/submissions/generate-waveform/route");
    const response = await POST(
      new Request("http://localhost/api/submissions/generate-waveform", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          submissionId: "submission-1",
          mediaUrl: "http://localhost/audio",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns a valid cached waveform without recomputing it", async () => {
    getTokenMock.mockResolvedValue({ token: "jwt-token" });
    queryMock.mockResolvedValue({
      waveform: JSON.stringify({ version: 1, channels: 1 }),
    });

    const { POST } = await import("@/app/api/submissions/generate-waveform/route");
    const response = await POST(
      new Request("http://localhost/api/submissions/generate-waveform", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          submissionId: "submission-1",
          mediaUrl: "http://localhost/audio-without-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      waveformJson: JSON.stringify({ version: 1, channels: 1 }),
    });
    expect(setAuthMock).toHaveBeenCalledWith("jwt-token");
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(verifyMediaAccessTokenMock).not.toHaveBeenCalled();
    expect(generateWaveformJsonFromAudioFileMock).not.toHaveBeenCalled();
    expect(mutationMock).not.toHaveBeenCalled();
  });
});
