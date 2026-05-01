import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeagueExportReportPage } from "@/components/league/LeagueExportReportPage";

const useQueryMock = vi.fn();
const toPngMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("html-to-image", () => ({
  toPng: (...args: unknown[]) => toPngMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: () => null,
}));

beforeEach(() => {
  useQueryMock.mockReset();
  toPngMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  toPngMock.mockResolvedValue("data:image/png;base64,test");
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

describe("LeagueExportReportPage", () => {
  it("renders the forbidden state for unauthorized users", () => {
    useQueryMock.mockReturnValue({ status: "forbidden" });

    render(<LeagueExportReportPage leagueId="league-1" />);

    expect(screen.getByText("Export Access Restricted")).toBeInTheDocument();
    expect(
      screen.getByText("Only league owners and managers can open this report."),
    ).toBeInTheDocument();
  });

  it("renders the empty export state when no rounds are finished", () => {
    useQueryMock.mockReturnValue({
      status: "ok",
      league: {
        leagueId: "league-1",
        name: "Synth League",
        description: "A league without results yet.",
        memberCount: 6,
        totalRounds: 4,
        finishedRoundCount: 0,
      },
      rounds: [],
      finalSummary: {
        standings: [],
        topFinishers: [],
        winnerSubmissions: [],
      },
    });

    render(<LeagueExportReportPage leagueId="league-1" />);

    expect(screen.getByText("No Finished Rounds Yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download All" })).toBeDisabled();
  });

  it("renders finished rounds and exports every card", async () => {
    useQueryMock.mockReturnValue({
      status: "ok",
      league: {
        leagueId: "league-1",
        name: "Synth League",
        description: "Neon nights only.",
        memberCount: 6,
        totalRounds: 2,
        finishedRoundCount: 2,
      },
      rounds: [
        {
          roundId: "round-1",
          roundOrder: 1,
          roundTitle: "Midnight Drive",
          roundDescription: "Late-night city songs.",
          roundImageUrl: null,
          winners: [
            {
              userId: "user-1",
              name: "Avery",
              image: undefined,
              songTitle: "Night Drive",
              points: 12,
            },
          ],
          submissions: [
            {
              submissionId: "submission-1",
              userId: "user-1",
              submitterName: "Avery",
              submitterImage: undefined,
              songTitle: "Night Drive",
              artist: "Test Artist",
              albumArtUrl: null,
              points: 12,
              isWinner: true,
            },
          ],
          standings: [
            {
              userId: "user-1",
              rank: 1,
              name: "Avery",
              image: undefined,
              totalPoints: 12,
              totalWins: 1,
              wonOnTieBreak: false,
              tieBreakSummary: null,
            },
          ],
        },
      ],
      finalSummary: {
        standings: [
          {
            userId: "user-1",
            rank: 1,
            name: "Avery",
            image: undefined,
            totalPoints: 22,
            totalWins: 1,
            wonOnTieBreak: false,
            tieBreakSummary: null,
          },
        ],
        topFinishers: [
          {
            userId: "user-1",
            rank: 1,
            name: "Avery",
            image: undefined,
            totalPoints: 22,
            wonOnTieBreak: false,
            tieBreakSummary: null,
          },
        ],
        winnerSubmissions: [
          {
            submissionId: "submission-1",
            roundId: "round-1",
            roundTitle: "Midnight Drive",
            songTitle: "Night Drive",
            artist: "Test Artist",
            albumArtUrl: null,
            points: 12,
          },
        ],
      },
    });

    render(<LeagueExportReportPage leagueId="league-1" />);

    expect(screen.getByText("Midnight Drive")).toBeInTheDocument();
    expect(screen.getAllByText("Night Drive").length).toBeGreaterThan(0);

    const downloadAllButton = screen.getByRole("button", {
      name: "Download All",
    });
    await waitFor(() => expect(downloadAllButton).toBeEnabled());

    fireEvent.click(downloadAllButton);

    await waitFor(() => expect(toPngMock).toHaveBeenCalledTimes(2));
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Exported every summary card.",
    );
  });
});
