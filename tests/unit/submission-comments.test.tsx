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
        authorName: "Hidden Falcon 218",
        authorImage: null,
        avatarSeed: "anon-1",
        authorVote: 2,
      },
    ]);

    render(<SubmissionComments submissionId={"submission-1" as never} />);

    expect(screen.getByText("Hidden Falcon 218")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("does not show a vote badge when the round is not finished", () => {
    useQueryMock.mockReturnValue([
      {
        _id: "comment-1",
        _creationTime: 1,
        submissionId: "submission-1",
        text: "Great pick",
        authorName: "Quiet Robin 504",
        authorImage: null,
        avatarSeed: "anon-1",
      },
    ]);

    render(<SubmissionComments submissionId={"submission-1" as never} />);

    expect(screen.getByText("Quiet Robin 504")).toBeInTheDocument();
    expect(screen.queryByText(/^[+-]?\d+$/)).not.toBeInTheDocument();
  });
});
