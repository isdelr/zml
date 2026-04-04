import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FinalVoteConfirmationDialog } from "@/components/round/FinalVoteConfirmationDialog";
import { SubmissionComments } from "@/components/round/SubmissionComments";

const { useQueryMock, useMusicPlayerStoreMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMusicPlayerStoreMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: useQueryMock,
  useMutation: vi.fn(),
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: true,
  })),
}));

vi.mock("@/hooks/useMusicPlayerStore", () => ({
  useMusicPlayerStore: useMusicPlayerStoreMock,
}));

describe("round translation hardening", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMusicPlayerStoreMock.mockImplementation(
      (selector: (state: { actions: { seek: ReturnType<typeof vi.fn> } }) => unknown) =>
      selector({
        actions: {
          seek: vi.fn(),
        },
      }),
    );
  });

  it("marks the final vote confirmation dialog as non-translatable", () => {
    render(
      <FinalVoteConfirmationDialog
        open
        confirmText="confirm"
        onConfirmTextChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const heading = screen.getByText("Final Vote Confirmation");
    const dialogContent = document.querySelector(
      '[data-slot="alert-dialog-content"]',
    );
    const confirmButton = screen.getByRole("button", {
      name: /confirm final vote/i,
    });

    expect(heading.closest('[data-slot="alert-dialog-content"]')).toBe(
      dialogContent,
    );
    expect(dialogContent).toHaveAttribute("translate", "no");
    expect(dialogContent).toHaveClass("notranslate");
    expect(confirmButton.querySelector("span")).not.toBeNull();
  });

  it("marks the comment expand/collapse control as non-translatable and keeps its text wrapped", async () => {
    useQueryMock.mockReturnValue([
      {
        _id: "comment-1",
        _creationTime: 4,
        text: "Fourth comment",
        authorName: "User 4",
        authorImage: null,
        authorVote: 1,
        avatarSeed: "seed-4",
      },
      {
        _id: "comment-2",
        _creationTime: 3,
        text: "Third comment",
        authorName: "User 3",
        authorImage: null,
        authorVote: 0,
        avatarSeed: "seed-3",
      },
      {
        _id: "comment-3",
        _creationTime: 2,
        text: "Second comment",
        authorName: "User 2",
        authorImage: null,
        authorVote: -1,
        avatarSeed: "seed-2",
      },
      {
        _id: "comment-4",
        _creationTime: 1,
        text: "First comment",
        authorName: "User 1",
        authorImage: null,
        authorVote: undefined,
        avatarSeed: "seed-1",
      },
    ]);

    render(<SubmissionComments submissionId={"submission-1" as never} />);

    const expandButton = screen.getByRole("button", {
      name: /view 1 older comment/i,
    });

    expect(expandButton).toHaveAttribute("translate", "no");
    expect(expandButton).toHaveClass("notranslate");
    expect(expandButton.querySelector("span")).not.toBeNull();

    fireEvent.click(expandButton);

    const collapseButton = screen.getByRole("button", { name: /show less/i });
    expect(collapseButton).toHaveAttribute("translate", "no");
    expect(collapseButton.querySelector("span")).not.toBeNull();
  });
});
