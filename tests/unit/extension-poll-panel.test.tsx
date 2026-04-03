import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation } from "convex/react";

import { ExtensionPollPanel } from "@/components/round/ExtensionPollPanel";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ExtensionPollPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.pointerEvents = "";
  });

  it("opens the request dialog when the user can request an extension", async () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    const user = userEvent.setup();

    render(
      <ExtensionPollPanel
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            poll: null,
            request: {
              canRequest: true,
              remainingRequests: 1,
              eligibilityReason: "unavailable",
              eligibleVoterCount: 3,
              requestWindowMs: 24 * 60 * 60 * 1000,
              isWithinWindow: true,
              isActiveMember: true,
            },
          } as never
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: /request extension/i }));

    expect(
      screen.getByRole("dialog", { name: /open anonymous extension poll/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the requester stays anonymous/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/last 1 day/i)).toHaveLength(2);
  });

  it("keeps the submit action disabled until the reason is long enough", async () => {
    const createPoll = vi.fn();

    vi.mocked(useMutation)
      .mockReturnValueOnce(createPoll as never)
      .mockReturnValueOnce(vi.fn() as never);

    const user = userEvent.setup();

    render(
      <ExtensionPollPanel
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            poll: null,
            request: {
              canRequest: true,
              remainingRequests: 2,
              eligibilityReason: "unavailable",
              eligibleVoterCount: 2,
              requestWindowMs: 24 * 60 * 60 * 1000,
              isWithinWindow: true,
              isActiveMember: true,
            },
          } as never
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: /request extension/i }));
    await user.type(screen.getByLabelText("Reason"), "too short");

    expect(screen.getByRole("button", { name: /open poll/i })).toBeDisabled();
    expect(createPoll).not.toHaveBeenCalled();
  });

  it("shows anonymous voting controls for eligible completed voters", () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    render(
      <ExtensionPollPanel
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            poll: {
              _id: "poll-1",
              reason: "I am traveling and need more time to finish listening.",
              status: "open",
              result: "pending",
              openedAt: new Date("2026-04-03T10:00:00Z").getTime(),
              resolvesAt: new Date("2026-04-04T10:00:00Z").getTime(),
              eligibleVoterCount: 4,
              yesVotes: 1,
              noVotes: 0,
              totalVotes: 1,
              appliedExtensionMs: 0,
              resolvedAt: null,
              currentUserVote: null,
              currentUserEligibleToVote: true,
              canCurrentUserVote: true,
            },
            request: {
              canRequest: false,
              remainingRequests: 1,
              eligibilityReason: "already_exists",
              eligibleVoterCount: 4,
              requestWindowMs: 24 * 60 * 60 * 1000,
              isWithinWindow: true,
              isActiveMember: true,
            },
          } as never
        }
      />,
    );

    expect(screen.getByText("Anonymous extension request")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /grant extension/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /no extension/i }),
    ).toBeInTheDocument();
  });
});
