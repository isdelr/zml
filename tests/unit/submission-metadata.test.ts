import { beforeEach, describe, expect, it, vi } from "vitest";

const parseBlobMock = vi.fn();

vi.mock("music-metadata", () => ({
  parseBlob: parseBlobMock,
}));

describe("parseAudioFileMetadata", () => {
  beforeEach(() => {
    parseBlobMock.mockReset();
  });

  it("floors fractional durations so manual files never store a rounded-up second", async () => {
    parseBlobMock.mockResolvedValue({
      format: {
        duration: 478.6,
      },
      common: {},
    });

    const { parseAudioFileMetadata } = await import("@/lib/submission/metadata");
    const file = new File(["audio"], "song.mp3", { type: "audio/mpeg" });
    const result = await parseAudioFileMetadata(file);

    expect(result.durationSeconds).toBe(478);
  });
});
