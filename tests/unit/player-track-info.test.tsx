import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerTrackInfo } from "@/components/player/PlayerTrackInfo";

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe("PlayerTrackInfo", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a standalone now playing toggle before the mobile overflow menu", async () => {
    const user = userEvent.setup();
    const onToggleContextView = vi.fn();
    const { container } = render(
      <PlayerTrackInfo
        currentTrack={
          {
            _id: "submission-1",
            roundId: "round-1",
            leagueId: "league-1",
            songTitle: "Night Drive",
            artist: "Test Artist",
            albumArtUrl: null,
            songFileUrl: "https://example.com/song.m4a",
            songLink: null,
            submissionType: "file",
          } as never
        }
        isBookmarked={false}
        onBookmarkToggle={vi.fn()}
        onQueueOpen={vi.fn()}
        onToggleContextView={onToggleContextView}
        isContextViewOpen={false}
      />,
    );

    const buttons = [...container.querySelectorAll("button")];

    expect(buttons[0]).toHaveAttribute("aria-label", "Show now playing view");
    expect(buttons[1]).toHaveAttribute("title", "Player options");

    await user.click(buttons[0]!);
    expect(onToggleContextView).toHaveBeenCalledTimes(1);

    await user.click(buttons[1]!);
    expect(
      screen.queryByRole("menuitem", { name: /show now playing view/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /bookmark song/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /open queue/i })).toBeInTheDocument();
  });
});
