import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    asChild,
    onSelect,
  }: {
    children: ReactNode;
    asChild?: boolean;
    onSelect?: () => void;
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type="button" role="menuitem" onClick={onSelect}>
        {children}
      </button>
    ),
}));

afterEach(() => {
  cleanup();
});

describe("SubmissionItem", () => {
  const renderSubmissionItem = (overrides = {}) => {
    const props = {
      song: {
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
      } as never,
      index: 0,
      isThisSongPlaying: false,
      isThisSongCurrent: false,
      userIsSubmitter: false,
      currentVoteValue: 0,
      roundStatus: "voting" as const,
      league: {
        creatorId: "user-1",
        managers: [],
        enforceListenPercentage: false,
        currentUserListenRequirementVoided: false,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
        limitVotesPerSubmission: false,
      } as never,
      canManageLeague: false,
      hasVoted: false,
      canVote: true,
      votingEligibilityReason: undefined,
      onVoteClick: vi.fn(),
      onBookmark: vi.fn(),
      onPlaySong: vi.fn(),
      listenProgress: undefined,
      listeners: [],
      voteDetails: [],
      currentUser: null,
      ...overrides,
    };

    render(<SubmissionItem {...props} />);
    return props;
  };

  it("renders the voting comment summary only once so it stays desktop-only", () => {
    renderSubmissionItem();

    const commentSummaries = [
      ...document.querySelectorAll('[data-slot="expandable-text-content"]'),
    ].filter(
      (element) =>
        element.textContent === "First paragraph.\n\nSecond paragraph.",
    );

    expect(commentSummaries).toHaveLength(1);
  });

  it("shows both upvote and downvote summaries on finished submissions", () => {
    renderSubmissionItem({
      roundStatus: "finished",
      voteDetails: [
        {
          voterId: "upvoter-1",
          voterName: "Up Voter",
          voterImage: null,
          score: 1,
          isDiscarded: false,
        },
        {
          voterId: "downvoter-1",
          voterName: "Down Voter",
          voterImage: null,
          score: -1,
          isDiscarded: false,
        },
      ],
    });

    expect(screen.getAllByText("+1")).not.toHaveLength(0);
    expect(screen.getAllByText("-1")).not.toHaveLength(0);
    expect(screen.getAllByTitle("Up Voter")).not.toHaveLength(0);
    expect(screen.getAllByTitle("Down Voter")).not.toHaveLength(0);
  });

  it("visually distinguishes discarded upvotes", () => {
    renderSubmissionItem({
      roundStatus: "finished",
      voteDetails: [
        {
          voterId: "late-voter-1",
          voterName: "Late Voter",
          voterImage: null,
          score: 1,
          isDiscarded: true,
        },
      ],
    });

    expect(screen.getAllByText("+1")).not.toHaveLength(0);
    expect(screen.queryByText("not counted")).not.toBeInTheDocument();
    for (const discardedGroup of screen.getAllByLabelText("Discarded votes")) {
      expect(discardedGroup).toHaveClass("border-dashed", "bg-muted/20");
    }
  });

  it("does not play or pause from a scroll gesture that starts on the play target", () => {
    const onPlaySong = vi.fn();
    renderSubmissionItem({ onPlaySong });

    const playTarget = screen.getAllByAltText("Night Drive")[0];
    expect(playTarget).toBeDefined();

    fireEvent.pointerDown(playTarget, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(playTarget, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 21,
      clientY: 40,
    });
    fireEvent.click(playTarget);

    expect(onPlaySong).not.toHaveBeenCalled();
  });

  it("shows the admin listening override directly above troll marking", () => {
    renderSubmissionItem({
      league: {
        creatorId: "user-1",
        managers: [],
        enforceListenPercentage: true,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
        limitVotesPerSubmission: false,
      },
      canManageLeague: true,
      currentUser: { _id: "user-1" },
    });

    const voidItem = screen.getAllByText("Void listening requirement")[0];
    const trollItem = screen.getAllByText("Mark as troll submission")[0];

    expect(voidItem).toBeInTheDocument();
    expect(trollItem).toBeInTheDocument();
    expect(
      voidItem.compareDocumentPosition(trollItem) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows restore copy when the listening requirement is already voided", () => {
    renderSubmissionItem({
      song: {
        _id: "submission-1",
        roundId: "round-1",
        leagueId: "league-1",
        songTitle: "Night Drive",
        artist: "Test Artist",
        albumArtUrl: null,
        songFileUrl: "https://example.com/song.m4a",
        songLink: null,
        submissionType: "file",
        listenRequirementVoided: true,
      } as never,
      league: {
        creatorId: "user-1",
        managers: [],
        enforceListenPercentage: true,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
        limitVotesPerSubmission: false,
      },
      canManageLeague: true,
      currentUser: { _id: "user-1" },
    });

    expect(
      screen.getAllByText("Restore listening requirement")[0],
    ).toBeInTheDocument();
  });

  it("does not show the listening override to non-admin users", () => {
    renderSubmissionItem({
      league: {
        creatorId: "user-1",
        managers: [],
        enforceListenPercentage: true,
        currentUserListenRequirementVoided: false,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
        limitVotesPerSubmission: false,
      },
      canManageLeague: false,
      currentUser: { _id: "user-2" },
    });

    expect(
      screen.queryByText("Void listening requirement"),
    ).not.toBeInTheDocument();
  });

  it("keeps voting disabled when the viewer has not met the listen requirement", () => {
    renderSubmissionItem({
      song: {
        _id: "submission-1",
        roundId: "round-1",
        leagueId: "league-1",
        songTitle: "Night Drive",
        artist: "Test Artist",
        albumArtUrl: null,
        songFileUrl: "https://example.com/song.m4a",
        songLink: null,
        submissionType: "file",
        duration: 240,
      } as never,
      league: {
        creatorId: "user-1",
        managers: [],
        enforceListenPercentage: true,
        currentUserListenRequirementVoided: false,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
        limitVotesPerSubmission: false,
      },
    });

    expect(screen.getAllByLabelText("Upvote")[0]).toBeDisabled();
  });

  it("removes the listen-based vote lock for exempt viewers", () => {
    renderSubmissionItem({
      song: {
        _id: "submission-1",
        roundId: "round-1",
        leagueId: "league-1",
        songTitle: "Night Drive",
        artist: "Test Artist",
        albumArtUrl: null,
        songFileUrl: "https://example.com/song.m4a",
        songLink: null,
        submissionType: "file",
        duration: 240,
      } as never,
      league: {
        creatorId: "user-1",
        managers: [],
        enforceListenPercentage: true,
        currentUserListenRequirementVoided: true,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
        limitVotesPerSubmission: false,
      },
    });

    expect(screen.getAllByLabelText("Upvote")[0]).not.toBeDisabled();
  });
});
