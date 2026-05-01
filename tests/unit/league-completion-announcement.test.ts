import { describe, expect, it } from "vitest";

import { buildLeagueCompletionAnnouncement } from "@/lib/discord/league-completion-announcement";

describe("buildLeagueCompletionAnnouncement", () => {
  it("builds a winner-focused announcement with podium lines", () => {
    const message = buildLeagueCompletionAnnouncement({
      leagueName: "Road Trip Draft",
      champion: {
        name: "Avery",
        totalPoints: 42,
        totalWins: 3,
      },
      championSubmissionCount: 5,
      championWonOnTieBreak: false,
      championTieBreakSummary: null,
      runnersUp: [
        {
          name: "Blake",
          totalPoints: 39,
          totalWins: 1,
        },
        {
          name: "Casey",
          totalPoints: 35,
          totalWins: 0,
        },
      ],
    });

    expect(message).toContain("**Avery** wins **Road Trip Draft** with **42 pts**.");
    expect(message).toContain("Round wins: **3**");
    expect(message).toContain("Submissions: **5**");
    expect(message).toContain("**Podium**");
    expect(message).toContain("2nd: **Blake** with **39 pts**");
    expect(message).toContain("3rd: **Casey** with **35 pts**");
  });

  it("includes tie-break context only when the champion needed it", () => {
    const message = buildLeagueCompletionAnnouncement({
      leagueName: "Road Trip Draft",
      champion: {
        name: "Avery",
        totalPoints: 42,
        totalWins: 3,
      },
      championSubmissionCount: 5,
      championWonOnTieBreak: true,
      championTieBreakSummary:
        "Won tie-break with more 1st-place finishes (3 to 2).",
      runnersUp: [],
    });

    expect(message).toContain(
      "Tie-break: Won tie-break with more 1st-place finishes (3 to 2).",
    );
  });
});
