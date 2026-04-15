import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NowPlayingView } from "@/components/NowPlayingView";

const { useMusicPlayerStoreMock, useActionMock } = vi.hoisted(() => ({
  useMusicPlayerStoreMock: vi.fn(),
  useActionMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: useActionMock,
}));

vi.mock("@/hooks/useMusicPlayerStore", () => ({
  useMusicPlayerStore: useMusicPlayerStoreMock,
}));

vi.mock("@/hooks/usePlaybackClockStore", () => ({
  usePlaybackClockStore: vi.fn(() => 0),
}));

vi.mock("@/hooks/useWindowSize", () => ({
  useWindowSize: () => ({ width: 1600 }),
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe("NowPlayingView", () => {
  it("preserves manual line breaks in the sidebar submission comment", () => {
    useActionMock.mockReturnValue(vi.fn());
    useMusicPlayerStoreMock.mockImplementation(
      (
        selector: (state: {
          currentTrackIndex: number;
          queue: Array<Record<string, unknown>>;
          isContextViewOpen: boolean;
          actions: { closeContextView: ReturnType<typeof vi.fn> };
        }) => unknown,
      ) =>
        selector({
          currentTrackIndex: 0,
          queue: [
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
              roundStatus: "voting",
              comment: "First paragraph.\n\nSecond paragraph.",
            },
          ],
          isContextViewOpen: true,
          actions: {
            closeContextView: vi.fn(),
          },
        }),
    );

    const { container } = render(<NowPlayingView />);
    const comment = container.querySelector("blockquote");

    expect(screen.getByText("Night Drive")).toBeInTheDocument();
    expect(comment).toHaveClass("whitespace-pre-wrap");
    expect(comment?.textContent).toContain("First paragraph.");
    expect(comment?.textContent).toContain("Second paragraph.");
  });
});
