import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubmissionsList } from "@/components/round/SubmissionsList";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => ({
    withOptimisticUpdate: () => vi.fn(),
  })),
}));

vi.mock("@/components/round/SubmissionItem", () => ({
  SubmissionItem: ({
    song,
  }: {
    song: {
      songTitle: string;
    };
  }) => <div data-testid="submission-item">{song.songTitle}</div>,
}));

type TestSubmission = {
  _id: string;
  userId: string;
  songTitle: string;
  artist: string;
  submissionType: "file" | "youtube";
  songLink: string | null;
  albumArtUrl: string | null;
  songFileUrl: string | null;
  points: number;
  isBookmarked: boolean;
};

const makeSubmission = (
  id: string,
  overrides: Partial<TestSubmission> = {},
): TestSubmission => ({
  _id: id,
  userId: "user-1",
  songTitle: `Song ${id}`,
  artist: "Artist",
  submissionType: "file",
  songLink: null,
  albumArtUrl: null,
  songFileUrl: null,
  points: 0,
  isBookmarked: false,
  ...overrides,
});

describe("SubmissionsList", () => {
  it("keeps finished-round submissions in the provided score order across source types", () => {
    render(
      <SubmissionsList
        submissions={
          [
            makeSubmission("yt-top", {
              songTitle: "Top YouTube Song",
              submissionType: "youtube",
              songLink: "https://youtube.com/watch?v=abc123def45",
              points: 12,
            }),
            makeSubmission("manual-lower", {
              songTitle: "Lower Manual Song",
              submissionType: "file",
              points: 5,
            }),
          ] as never
        }
        userVoteStatus={undefined}
        userVotes={[]}
        currentUser={null}
        roundStatus="finished"
        league={{ isSpectator: false } as never}
        canManageLeague={false}
        currentTrackIndex={null}
        isPlaying={false}
        queue={[]}
        onPlaySong={vi.fn()}
        onVoteClick={vi.fn()}
        listenProgressMap={{}}
        activeCommentsSubmissionId={null}
        onToggleComments={vi.fn()}
        listenersBySubmission={undefined}
        playlistListeners={undefined}
        voteSummaryBySubmission={{}}
        positiveVotesRemaining={0}
        negativeVotesRemaining={0}
        isVoteFinal={false}
        effectiveMaxUp={1}
        effectiveMaxDown={0}
      />,
    );

    expect(
      screen.getAllByTestId("submission-item").map((item) => item.textContent),
    ).toEqual(["Top YouTube Song", "Lower Manual Song"]);
  });
});
