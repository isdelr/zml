import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SubmissionComments } from "@/components/round/SubmissionComments";

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({ isAuthenticated: false })),
  useMutation: vi.fn(() => ({
    withOptimisticUpdate: () => vi.fn(),
  })),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/hooks/useMusicPlayerStore", () => ({
  useMusicPlayerStore: (selector: (state: { actions: { seek: () => void } }) => unknown) =>
    selector({
      actions: {
        seek: vi.fn(),
      },
    }),
}));

describe("SubmissionComments", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the commenter's vote next to their name for finished-round comments", () => {
    useQueryMock.mockReturnValue([
      {
        _id: "comment-1",
        _creationTime: 1,
        submissionId: "submission-1",
        text: "Great pick",
        authorName: "Alice",
        authorImage: "https://example.com/alice.png",
        avatarSeed: "user-1",
        authorVote: 2,
      },
    ]);

    render(<SubmissionComments submissionId={"submission-1" as never} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("does not show a vote badge when the round is not finished", () => {
    useQueryMock.mockReturnValue([
      {
        _id: "comment-1",
        _creationTime: 1,
        submissionId: "submission-1",
        text: "Great pick",
        authorName: "Harbor",
        authorImage: null,
        avatarSeed: "anon-1",
      },
    ]);

    render(<SubmissionComments submissionId={"submission-1" as never} />);

    expect(screen.getByText("Harbor")).toBeInTheDocument();
    expect(screen.queryByText(/^[+-]?\d+$/)).not.toBeInTheDocument();
  });

  it("shows the most recent comments first for anonymous round comments", () => {
    useQueryMock.mockReturnValue([
      {
        _id: "comment-older",
        _creationTime: 1,
        submissionId: "submission-1",
        text: "Older comment",
        authorName: "Harbor",
        authorImage: null,
        avatarSeed: "anon-older",
      },
      {
        _id: "comment-newer",
        _creationTime: 2,
        submissionId: "submission-1",
        text: "Newest comment",
        authorName: "Cedar",
        authorImage: null,
        avatarSeed: "anon-newer",
      },
    ]);

    render(<SubmissionComments submissionId={"submission-1" as never} />);

    expect(
      screen
        .getAllByText(/^(Older comment|Newest comment)$/)
        .map((element) => element.textContent),
    ).toEqual(["Newest comment", "Older comment"]);
  });
});
