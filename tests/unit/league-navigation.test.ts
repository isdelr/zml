import { describe, expect, it } from "vitest";

import {
  buildLeagueHref,
  buildLeagueRoundHref,
  getPreferredRoundId,
} from "@/lib/leagues/navigation";

describe("league navigation", () => {
  it("builds stats links on the base league page", () => {
    expect(
      buildLeagueHref({
        leagueId: "league-1",
        searchParams: "foo=bar&round=old-round",
        tab: "stats",
      }),
    ).toBe("/leagues/league-1?foo=bar&tab=stats");
  });

  it("builds round links without the removed tab query", () => {
    expect(
      buildLeagueRoundHref({
        leagueId: "league-1",
        roundId: "round-7",
        searchParams: "tab=standings&foo=bar&round=old-round",
      }),
    ).toBe("/leagues/league-1/round/round-7?foo=bar");
  });

  it("prefers voting rounds, then submissions, then scheduled rounds, then the first round", () => {
    expect(
      getPreferredRoundId([
        { _id: "round-1", status: "finished" },
        { _id: "round-2", status: "voting" },
        { _id: "round-3", status: "submissions" },
      ]),
    ).toBe("round-2");

    expect(
      getPreferredRoundId([
        { _id: "round-1", status: "finished" },
        { _id: "round-2", status: "scheduled" },
      ]),
    ).toBe("round-2");

    expect(
      getPreferredRoundId([
        { _id: "round-1", status: "finished" },
        { _id: "round-2", status: "submissions" },
      ]),
    ).toBe("round-2");

    expect(
      getPreferredRoundId([{ _id: "round-1", status: "finished" }]),
    ).toBe("round-1");
  });
});
