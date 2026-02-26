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
        userId: "u1",
      },
      {
        _id: "c2" as Id<"comments">,
        text: "No timestamp here",
        authorName: "B",
        authorImage: null,
        userId: "u2",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "c1",
      time: 75,
      text: "Great drop",
      authorName: "A",
      authorId: "u1",
    });
  });

  it("ignores invalid timestamp format", () => {
    const result = extractTimestampedWaveformComments([
      {
        _id: "c1" as Id<"comments">,
        text: "Bad timestamp @1:aa",
        userId: "u1",
      },
    ]);
    expect(result).toEqual([]);
  });
});
