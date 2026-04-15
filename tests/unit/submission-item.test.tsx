import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubmissionItem } from "@/components/round/SubmissionItem";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@/hooks/useMusicPlayerStore", () => ({
  useMusicPlayerStore: (
    selector: (state: { listenProgress: Record<string, boolean> }) => unknown,
  ) =>
    selector({
      listenProgress: {},
    }),
}));

vi.mock("@/components/round/SubmissionComments", () => ({
  SubmissionCommentComposerButton: () => (
    <button type="button" aria-label="Add comment">
      Add comment
    </button>
  ),
  SubmissionComments: () => null,
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe("SubmissionItem", () => {
  it("renders the voting comment summary only once so it stays desktop-only", () => {
    render(
      <SubmissionItem
        song={
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
            comment: "First paragraph.\n\nSecond paragraph.",
          } as never
        }
        index={0}
        isThisSongPlaying={false}
        isThisSongCurrent={false}
        userIsSubmitter={false}
        currentVoteValue={0}
        roundStatus="voting"
        league={
          {
            creatorId: "user-1",
            managers: [],
            enforceListenPercentage: false,
            listenPercentage: 100,
            listenTimeLimitMinutes: 15,
            limitVotesPerSubmission: false,
          } as never
        }
        canManageLeague={false}
        hasVoted={false}
        canVote={true}
        votingEligibilityReason={undefined}
        onVoteClick={vi.fn()}
        onBookmark={vi.fn()}
        onPlaySong={vi.fn()}
        listenProgress={undefined}
        listeners={[]}
        voteDetails={[]}
        currentUser={null}
      />,
    );

    const commentSummaries = [
      ...document.querySelectorAll('[data-slot="expandable-text-content"]'),
    ].filter(
      (element) =>
        element.textContent === "First paragraph.\n\nSecond paragraph.",
    );

    expect(commentSummaries).toHaveLength(1);
  });
});
