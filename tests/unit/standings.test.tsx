import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Standings } from "@/components/Standings";

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useQueryMock.mockReset();
});

describe("Standings", () => {
  it("renders returned ranks and a tie-break badge for winners of point ties", () => {
    useQueryMock.mockReturnValue([
      {
        userId: "user-2",
        rank: 2,
        name: "Second",
        totalPoints: 12,
        wonOnTieBreak: true,
        tieBreakSummary: "Won tie-break with more 1st-place finishes (2 to 1).",
      },
      {
        userId: "user-4",
        rank: 4,
        name: "Fourth",
        totalPoints: 8,
        wonOnTieBreak: false,
        tieBreakSummary: null,
      },
    ]);

    render(<Standings leagueId={"league-1" as never} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("TB")).toBeInTheDocument();
    expect(screen.getByText("12 pts")).toBeInTheDocument();
    expect(screen.queryAllByText("TB")).toHaveLength(1);
  });

  it("renders the empty state when there are no standings", () => {
    useQueryMock.mockReturnValue([]);

    render(<Standings leagueId={"league-1" as never} />);

    expect(screen.getByText("No standings to show yet.")).toBeInTheDocument();
  });
});
