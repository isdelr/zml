import { describe, expect, it } from "vitest";
import { getSortedRoundSubmissions } from "@/lib/rounds/submission-order";

type Submission = {
  _id: string;
  submissionType: "file" | "youtube";
  points: number;
};

describe("getSortedRoundSubmissions", () => {
  it("sorts by points when round is finished", () => {
    const submissions: Submission[] = [
      { _id: "a", submissionType: "file", points: 1 },
      { _id: "b", submissionType: "youtube", points: 5 },
      { _id: "c", submissionType: "file", points: 3 },
    ];

    const sorted = getSortedRoundSubmissions(submissions, "finished", "round1");
    expect(sorted.map((s) => s._id)).toEqual(["b", "c", "a"]);
  });

  it("is deterministic for active rounds", () => {
    const submissions: Submission[] = [
      { _id: "s1", submissionType: "file", points: 0 },
      { _id: "s2", submissionType: "file", points: 0 },
      { _id: "s3", submissionType: "youtube", points: 0 },
      { _id: "s4", submissionType: "youtube", points: 0 },
    ];

    const a = getSortedRoundSubmissions(submissions, "voting", "round42");
    const b = getSortedRoundSubmissions(submissions, "voting", "round42");

    expect(a.map((s) => s._id)).toEqual(b.map((s) => s._id));
  });
});

