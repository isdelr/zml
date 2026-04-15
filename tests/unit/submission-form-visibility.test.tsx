import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubmissionForm } from "@/components/round/SubmissionForm";

const { useMusicPlayerStoreMock } = vi.hoisted(() => ({
  useMusicPlayerStoreMock: vi.fn(),
}));

vi.mock("@/components/AlbumSubmissionForm", () => ({
  AlbumSubmissionForm: () => <div>album form</div>,
}));

vi.mock("@/components/EditSubmissionForm", () => ({
  EditSubmissionForm: () => <div>edit form</div>,
}));

vi.mock("@/components/MultiSongSubmissionForm", () => ({
  MultiSongSubmissionForm: () => <div>multi form</div>,
}));

vi.mock("@/components/SongSubmissionForm", () => ({
  SongSubmissionForm: () => <div>single form</div>,
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <div aria-label={alt} role="img" />,
}));

vi.mock("@/hooks/useMusicPlayerStore", () => ({
  useMusicPlayerStore: useMusicPlayerStoreMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type TestSubmission = {
  _id: string;
  userId: string;
  songTitle: string;
  artist: string;
  roundId: string;
  leagueId: string;
  submissionType: "file" | "youtube";
  collectionId?: string | null;
  albumArtUrl: string | null;
  songFileUrl: string | null;
  songLink?: string | null;
  fileProcessingStatus?: "queued" | "converting" | "ready" | "failed";
};

function createSubmission(
  id: string,
  overrides: Partial<TestSubmission> = {},
): TestSubmission {
  return {
    _id: id,
    userId: "user-1",
    songTitle: `Song ${id}`,
    artist: "Artist",
    roundId: "round-1",
    leagueId: "league-1",
    submissionType: "youtube",
    collectionId: "collection-1",
    albumArtUrl: null,
    songFileUrl: null,
    songLink: "https://youtu.be/abc123def45",
    ...overrides,
  };
}

const multiRound = {
  _id: "round-1",
  title: "Two Song Round",
  order: 1,
  status: "submissions",
  submissionMode: "multi",
  submissionsPerUser: 2,
} as const;

const currentUser = {
  _id: "user-1",
  name: "Listener",
} as const;

describe("SubmissionForm", () => {
  beforeEach(() => {
    useMusicPlayerStoreMock.mockReset();
    useMusicPlayerStoreMock.mockImplementation(
      (selector: (state: { actions: { playSong: ReturnType<typeof vi.fn> } }) => unknown) =>
        selector({
          actions: {
            playSong: vi.fn(),
          },
        }),
    );
  });

  it.each(["scheduled", "submissions"] as const)(
    "hides the multi submit form once the user has already submitted the full song limit in %s state",
    (roundStatus) => {
      const submissions = [
        createSubmission("submission-1"),
        createSubmission("submission-2"),
      ];

      const view = render(
        <SubmissionForm
          round={{ ...multiRound, status: roundStatus } as never}
          roundStatus={roundStatus}
          currentUser={currentUser as never}
          mySubmissions={submissions as never}
          allSubmissions={submissions as never}
          activeMemberCount={3}
          leagueName="League"
        />,
      );

      expect(screen.queryByText("multi form")).not.toBeInTheDocument();
      expect(
        within(view.container).getByText(/song submission-1, song submission-2/i),
      ).toBeInTheDocument();
      fireEvent.click(within(view.container).getAllByRole("button")[0]);
      expect(
        within(view.container).getAllByText("Song submission-1"),
      ).toHaveLength(2);
      expect(
        within(view.container).getAllByText("Song submission-2"),
      ).toHaveLength(2);
      expect(
        within(view.container).getAllByRole("button", { name: "Edit" }),
      ).toHaveLength(4);
    },
  );

  it("shows the multi submit form when the user is still below the song limit", () => {
    const submissions = [createSubmission("submission-1")];

    const view = render(
      <SubmissionForm
        round={multiRound as never}
        roundStatus="submissions"
        currentUser={currentUser as never}
        mySubmissions={submissions as never}
        allSubmissions={submissions as never}
        activeMemberCount={3}
        leagueName="League"
      />,
    );

    expect(within(view.container).getByText("multi form")).toBeInTheDocument();
  });
});
