import { describe, expect, it } from "vitest";
import { Id } from "@/convex/_generated/dataModel";
import { extractTimestampedWaveformComments } from "@/lib/music/comments";

describe("extractTimestampedWaveformComments", () => {
  it("extracts timestamped comments and strips marker text", () => {
    const result = extractTimestampedWaveformComments([
      {
        _id: "c1" as Id<"comments">,
        text: "Great drop @01:15",
        authorName: "A",
        authorImage: null,
        avatarSeed: "anon-1",
      },
      {
        _id: "c2" as Id<"comments">,
        text: "No timestamp here",
        authorName: "B",
        authorImage: null,
        avatarSeed: "anon-2",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "c1",
      time: 75,
      text: "Great drop",
      authorName: "A",
      avatarSeed: "anon-1",
    });
  });

  it("ignores invalid timestamp format", () => {
    const result = extractTimestampedWaveformComments([
      {
        _id: "c1" as Id<"comments">,
        text: "Bad timestamp @1:aa",
        avatarSeed: "anon-1",
      },
    ]);
    expect(result).toEqual([]);
  });
});
