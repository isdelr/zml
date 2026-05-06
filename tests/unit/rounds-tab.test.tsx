import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { RoundsTab } from "@/components/league/settings/RoundsTab";

const createRoundMock = vi.fn();
const deleteRoundMock = vi.fn();
const swapRoundScheduleSlotsMock = vi.fn();
const useMutationMock = vi.fn();
const usePaginatedQueryMock = vi.fn();

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: {
      configurable: true,
      value: vi.fn(() => false),
    },
    releasePointerCapture: {
      configurable: true,
      value: vi.fn(),
    },
    scrollIntoView: {
      configurable: true,
      value: vi.fn(),
    },
    setPointerCapture: {
      configurable: true,
      value: vi.fn(),
    },
  });
});

afterEach(() => {
  cleanup();
  document.body.style.pointerEvents = "";
  document.body.removeAttribute("data-scroll-locked");
});

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
    swapRoundScheduleSlotsMock.mockReset();
    createRoundMock.mockResolvedValue("round-2");
    deleteRoundMock.mockResolvedValue({ success: true });
    swapRoundScheduleSlotsMock.mockResolvedValue({ success: true });

    useMutationMock.mockReset();
    let mutationCallIndex = 0;
    useMutationMock.mockImplementation(() => {
      const mutations = [
        createRoundMock,
        deleteRoundMock,
        swapRoundScheduleSlotsMock,
      ];
      const mutation = mutations[mutationCallIndex % mutations.length];
      mutationCallIndex += 1;
      return mutation;
    });

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
        {
          _id: "round-voting",
          title: "Voting Round",
          description: "A round already in voting.",
          status: "voting",
          submissionStartsAt: new Date("2026-03-18T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-21T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-24T00:00:00Z").getTime(),
        },
        {
          _id: "round-finished",
          title: "Finished Round",
          description: "A completed round.",
          status: "finished",
          submissionStartsAt: new Date("2026-03-11T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-14T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-17T00:00:00Z").getTime(),
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

    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("opens the swap dialog from a row action and swaps the selected rounds", async () => {
    const user = userEvent.setup();

    render(<RoundsTab league={{ _id: "league-1" } as never} />);

    await user.click(screen.getAllByRole("button", { name: "Swap" })[0]);

    const dialog = screen.getByRole("dialog", { name: "Swap rounds" });
    expect(
      within(dialog).getByText(
        /"Next Up" will open for submissions with the current submission deadline/i,
      ),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Swap rounds" }),
    );

    await waitFor(() => {
      expect(swapRoundScheduleSlotsMock).toHaveBeenCalledWith({
        firstRoundId: "round-1",
        secondRoundId: "round-0",
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Swap rounds" }),
      ).not.toBeInTheDocument();
    });
  });

  it("excludes voting and finished rounds from swap options", async () => {
    const user = userEvent.setup();

    render(<RoundsTab league={{ _id: "league-1" } as never} />);

    await user.click(screen.getAllByRole("button", { name: "Swap rounds" })[0]);
    await user.click(screen.getByRole("combobox", { name: "First round" }));

    expect(
      screen.getByRole("option", { name: /Next Up - Scheduled/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Current Round - Submissions/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Voting Round - Voting/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Finished Round - Finished/i }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    const dialogAfterClosingSelect = screen.queryByRole("dialog", {
      name: "Swap rounds",
    });
    if (dialogAfterClosingSelect) {
      await user.click(
        within(dialogAfterClosingSelect).getByRole("button", {
          name: "Cancel",
        }),
      );
    }
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Swap rounds" }),
      ).not.toBeInTheDocument();
    });
  });

  it("disables swapping when fewer than two rounds are eligible", () => {
    usePaginatedQueryMock.mockReturnValue({
      results: [
        {
          _id: "round-1",
          title: "Only Future Round",
          description: "A future round ready to be scheduled.",
          status: "scheduled",
          submissionStartsAt: new Date("2026-04-01T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-04-04T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-04-07T00:00:00Z").getTime(),
        },
        {
          _id: "round-voting",
          title: "Voting Round",
          description: "A round already in voting.",
          status: "voting",
          submissionStartsAt: new Date("2026-03-18T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-21T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-24T00:00:00Z").getTime(),
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    render(<RoundsTab league={{ _id: "league-1" } as never} />);

    expect(
      screen.getAllByRole("button", { name: "Swap rounds" })[0],
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Swap" })).toBeDisabled();
  });
});
