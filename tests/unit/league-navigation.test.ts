import { describe, expect, it } from "vitest";

import {
  buildLeagueRoundHref,
  buildLeagueTabHref,
  getPreferredRoundId,
} from "@/lib/leagues/navigation";

describe("league navigation", () => {
  it("keeps standings on the league root route", () => {
    expect(
      buildLeagueTabHref({
        leagueId: "league-1",
        tab: "standings",
        searchParams: "foo=bar",
        selectedRoundId: "round-9",
      }),
    ).toBe("/leagues/league-1?foo=bar&tab=standings");
  });

  it("uses the selected round when switching back to rounds", () => {
    expect(
      buildLeagueTabHref({
        leagueId: "league-1",
        tab: "rounds",
        searchParams: "tab=standings",
        selectedRoundId: "round-9",
        fallbackRoundId: "round-2",
      }),
    ).toBe("/leagues/league-1/round/round-9?tab=rounds");
  });

  it("falls back to the preferred round when no round is selected", () => {
    expect(
      buildLeagueTabHref({
        leagueId: "league-1",
        tab: "rounds",
        searchParams: "",
        fallbackRoundId: "round-2",
      }),
    ).toBe("/leagues/league-1/round/round-2?tab=rounds");
  });

  it("builds round links with the updated rounds query", () => {
    expect(
      buildLeagueRoundHref({
        leagueId: "league-1",
        roundId: "round-7",
        searchParams: "tab=standings&foo=bar&round=old-round",
      }),
    ).toBe("/leagues/league-1/round/round-7?tab=rounds&foo=bar");
  });

  it("prefers voting rounds, then submissions, then the first round", () => {
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
        { _id: "round-2", status: "submissions" },
      ]),
    ).toBe("round-2");

    expect(
      getPreferredRoundId([{ _id: "round-1", status: "finished" }]),
    ).toBe("round-1");
  });
});
