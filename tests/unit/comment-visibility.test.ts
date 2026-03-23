import { describe, expect, it } from "vitest";

import { shouldRevealCommentIdentity } from "@/lib/comments/visibility";

describe("shouldRevealCommentIdentity", () => {
  it("keeps anonymous comments anonymous before the round finishes", () => {
    expect(
      shouldRevealCommentIdentity({
        isAnonymous: true,
        revealOnRoundFinished: true,
        roundStatus: "voting",
      }),
    ).toBe(false);
  });

  it("reveals anonymous comment identities after the round finishes", () => {
    expect(
      shouldRevealCommentIdentity({
        isAnonymous: true,
        revealOnRoundFinished: true,
        roundStatus: "finished",
      }),
    ).toBe(true);
  });

  it("keeps non-anonymous comments revealed in active rounds", () => {
    expect(
      shouldRevealCommentIdentity({
        isAnonymous: false,
        roundStatus: "submissions",
      }),
    ).toBe(true);
  });

  it("supports legacy comments that stay anonymous even after finish", () => {
    expect(
      shouldRevealCommentIdentity({
        isAnonymous: true,
        revealOnRoundFinished: false,
        roundStatus: "finished",
      }),
    ).toBe(false);
  });
});
