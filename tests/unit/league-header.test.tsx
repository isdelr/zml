import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeagueHeader } from "@/components/league/LeagueHeader";

const useMutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    promise: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useMutationMock.mockReset();
  useMutationMock.mockReturnValue(vi.fn());
});

describe("LeagueHeader", () => {
  it("shows the export summary link for league managers", () => {
    render(
      <LeagueHeader
        leagueData={{
          _id: "league-1",
          inviteCode: null,
          canManageLeague: true,
          isMember: true,
          isOwner: true,
        } as never}
        currentUser={null}
        searchTerm=""
        onSearchChange={vi.fn()}
        onSettingsOpen={vi.fn()}
        searchContainerRef={createRef()}
        searchResults={undefined}
        handleRoundSelect={vi.fn()}
        playerActions={{ playSong: vi.fn() }}
      />,
    );

    const link = screen.getByRole("link", { name: "Export Summary" });
    expect(link).toHaveAttribute("href", "/reports/leagues/league-1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("hides the export summary link for non-managers", () => {
    render(
      <LeagueHeader
        leagueData={{
          _id: "league-1",
          inviteCode: null,
          canManageLeague: false,
          isMember: true,
          isOwner: false,
        } as never}
        currentUser={null}
        searchTerm=""
        onSearchChange={vi.fn()}
        onSettingsOpen={vi.fn()}
        searchContainerRef={createRef()}
        searchResults={undefined}
        handleRoundSelect={vi.fn()}
        playerActions={{ playSong: vi.fn() }}
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Export Summary" }),
    ).not.toBeInTheDocument();
  });
});
