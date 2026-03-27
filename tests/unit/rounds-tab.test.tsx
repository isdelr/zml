import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoundsTab } from "@/components/league/settings/RoundsTab";

const createRoundMock = vi.fn();
const deleteRoundMock = vi.fn();
const useMutationMock = vi.fn();
const usePaginatedQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...args),
  usePaginatedQuery: (...args: unknown[]) => usePaginatedQueryMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

describe("RoundsTab", () => {
  beforeEach(() => {
    createRoundMock.mockReset();
    deleteRoundMock.mockReset();
    createRoundMock.mockResolvedValue("round-2");
    deleteRoundMock.mockResolvedValue({ success: true });

    useMutationMock.mockReset();
    useMutationMock
      .mockImplementationOnce(() => createRoundMock)
      .mockImplementationOnce(() => deleteRoundMock);

    usePaginatedQueryMock.mockReset();
    usePaginatedQueryMock.mockReturnValue({
      results: [
        {
          _id: "round-1",
          title: "Next Up",
          description: "A future round ready to be scheduled.",
          status: "scheduled",
          submissionStartsAt: new Date("2026-04-01T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-04-04T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-04-07T00:00:00Z").getTime(),
        },
        {
          _id: "round-0",
          title: "Current Round",
          description: "An active round already in progress.",
          status: "submissions",
          submissionStartsAt: new Date("2026-03-25T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-28T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-31T00:00:00Z").getTime(),
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    });
  });

  it("asks for confirmation before deleting a scheduled round", async () => {
    const user = userEvent.setup();

    render(<RoundsTab league={{ _id: "league-1" } as never} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete round?")).toBeInTheDocument();
    expect(
      screen.getByText(
        'Remove "Next Up" from this league? Any later scheduled rounds will move up to close the gap.',
      ),
    ).toBeInTheDocument();
    expect(deleteRoundMock).not.toHaveBeenCalled();
  });
});
