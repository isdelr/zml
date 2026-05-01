import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeagueWinnersCardContent } from "@/components/league/LeagueWinnersCard";

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

afterEach(() => {
  cleanup();
});

describe("LeagueWinnersCardContent", () => {
  it("does not render for unfinished leagues", () => {
    const { container } = render(
      <LeagueWinnersCardContent
        summary={{
          isLeagueFinished: false,
          topFinishers: [],
          winnerSubmissions: [],
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the podium and champion submissions for completed leagues", () => {
    render(
      <LeagueWinnersCardContent
        summary={{
          isLeagueFinished: true,
          topFinishers: [
            {
              userId: "user-1" as never,
              rank: 1,
              name: "Avery",
              image: undefined,
              totalPoints: 42,
              wonOnTieBreak: true,
              tieBreakSummary:
                "Won tie-break with more 1st-place finishes (3 to 2).",
            },
            {
              userId: "user-2" as never,
              rank: 2,
              name: "Blake",
              image: undefined,
              totalPoints: 42,
              wonOnTieBreak: false,
              tieBreakSummary: null,
            },
            {
              userId: "user-3" as never,
              rank: 3,
              name: "Casey",
              image: undefined,
              totalPoints: 38,
              wonOnTieBreak: false,
              tieBreakSummary: null,
            },
          ],
          winnerSubmissions: [
            {
              submissionId: "submission-1" as never,
              roundId: "round-1" as never,
              roundTitle: "Round One",
              songTitle: "Night Drive",
              artist: "Test Artist",
              albumArtUrl: null,
              points: 12,
            },
            {
              submissionId: "submission-2" as never,
              roundId: "round-2" as never,
              roundTitle: "Round Two",
              songTitle: "Sunrise",
              artist: "Another Artist",
              albumArtUrl: null,
              points: 10,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("League Complete")).toBeInTheDocument();
    expect(screen.getByText("Avery")).toBeInTheDocument();
    expect(screen.getAllByText("42 pts").length).toBeGreaterThan(0);
    expect(screen.getByText("Champion Submissions")).toBeInTheDocument();
    expect(screen.getByText("Round One")).toBeInTheDocument();
    expect(screen.getByText("Night Drive")).toBeInTheDocument();
    expect(screen.getAllByText("Tie-break").length).toBeGreaterThan(0);
  });
});
