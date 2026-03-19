import { describe, expect, it } from "vitest";

import { getAnonymousCommentIdentity } from "@/lib/comments/anonymous";

describe("getAnonymousCommentIdentity", () => {
  it("returns the same alias and avatar seed for the same user within a round", () => {
    const first = getAnonymousCommentIdentity("round-1", "user-1");
    const second = getAnonymousCommentIdentity("round-1", "user-1");

    expect(second).toEqual(first);
  });

  it("changes the anonymous identity when the round changes", () => {
    const first = getAnonymousCommentIdentity("round-1", "user-1");
    const second = getAnonymousCommentIdentity("round-2", "user-1");

    expect(second).not.toEqual(first);
  });
});
