import { describe, expect, it } from "vitest";
import {
  getRoundNotificationPath,
  isNotificationLinkForRound,
} from "@/lib/notifications/round-link";

describe("round notification links", () => {
  it("builds the canonical round notification path", () => {
    expect(getRoundNotificationPath("league-1", "round-1")).toBe(
      "/leagues/league-1/round/round-1",
    );
  });

  it("matches exact round links with query, hash, absolute URL, and trailing slash", () => {
    expect(
      isNotificationLinkForRound(
        "/leagues/league-1/round/round-1?from=badge",
        "league-1",
        "round-1",
      ),
    ).toBe(true);
    expect(
      isNotificationLinkForRound(
        "https://zml.app/leagues/league-1/round/round-1#comments",
        "league-1",
        "round-1",
      ),
    ).toBe(true);
    expect(
      isNotificationLinkForRound(
        "/leagues/league-1/round/round-1/",
        "league-1",
        "round-1",
      ),
    ).toBe(true);
  });

  it("does not match other rounds or non-round links", () => {
    expect(
      isNotificationLinkForRound(
        "/leagues/league-1/round/round-2",
        "league-1",
        "round-1",
      ),
    ).toBe(false);
    expect(
      isNotificationLinkForRound("/notifications", "league-1", "round-1"),
    ).toBe(false);
  });
});
