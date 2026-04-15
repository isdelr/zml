import { describe, expect, it } from "vitest";
import { getRoundSubmitterSummary } from "@/lib/rounds/submitter-summary";

describe("getRoundSubmitterSummary", () => {
  const members = [
    { _id: "u1", name: "A", image: null },
    { _id: "u2", name: "B", image: null },
    { _id: "u3", name: "C", image: null },
  ];

  it("marks all members missing when submissions are unavailable", () => {
    const result = getRoundSubmitterSummary(members, undefined, 1);
    expect(result.totalMembers).toBe(3);
    expect(result.completedSubmitters).toEqual([]);
    expect(result.missingSubmitters).toHaveLength(3);
  });

  it("splits completed and missing members by submissionsPerUser", () => {
    const submissions = [{ userId: "u1" }, { userId: "u1" }, { userId: "u2" }];
    const result = getRoundSubmitterSummary(members, submissions, 2);

    expect(result.completedSubmitters.map((member) => member.name)).toEqual(["A"]);
    expect(result.missingSubmitters.map((member) => member.name)).toEqual(["B", "C"]);
  });

  it("treats album rounds as one completion per collection", () => {
    const submissions = [
      { userId: "u1", collectionId: "collection-1" },
      { userId: "u1", collectionId: "collection-1" },
      { userId: "u2", collectionId: "collection-2" },
    ];

    const result = getRoundSubmitterSummary(members, submissions, 1, "album");

    expect(result.completedSubmitters.map((member) => member.name)).toEqual([
      "A",
      "B",
    ]);
    expect(result.missingSubmitters.map((member) => member.name)).toEqual(["C"]);
  });

  it("treats multi-track rounds as one completion per track", () => {
    const submissions = [
      { userId: "u1", collectionId: "collection-1" },
      { userId: "u1", collectionId: "collection-1" },
      { userId: "u2", collectionId: "collection-2" },
    ];

    const result = getRoundSubmitterSummary(members, submissions, 2, "multi");

    expect(result.completedSubmitters.map((member) => member.name)).toEqual([
      "A",
    ]);
    expect(result.missingSubmitters.map((member) => member.name)).toEqual([
      "B",
      "C",
    ]);
  });
});
