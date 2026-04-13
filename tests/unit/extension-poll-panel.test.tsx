import { cleanup, render, screen } from "@testing-library/react";
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
    cleanup();
    vi.clearAllMocks();
    document.body.style.pointerEvents = "";
  });

  it("opens the voting request dialog when the user can request an extension", async () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    const user = userEvent.setup();

    render(
      <ExtensionPollPanel
        pollType="voting"
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            type: "voting",
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

    await user.click(
      screen.getByRole("button", { name: /request voting extension/i }),
    );

    expect(
      screen.getByRole("dialog", {
        name: /open anonymous voting extension poll/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the requester stays anonymous/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/last 1 day/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /uses 1 of your 2 league-wide requests, shared between submission and voting/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the submit action disabled until the reason is long enough", async () => {
    const createPoll = vi.fn();

    vi.mocked(useMutation)
      .mockReturnValueOnce(createPoll as never)
      .mockReturnValueOnce(vi.fn() as never);

    const user = userEvent.setup();

    render(
      <ExtensionPollPanel
        pollType="voting"
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            type: "voting",
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

    await user.click(
      screen.getByRole("button", { name: /request voting extension/i }),
    );
    await user.type(screen.getByLabelText("Reason"), "too short");

    expect(screen.getByRole("button", { name: /open voting poll/i })).toBeDisabled();
    expect(createPoll).not.toHaveBeenCalled();
  });

  it("explains that failed requests still consume shared tries", () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    render(
      <ExtensionPollPanel
        pollType="voting"
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            type: "voting",
            poll: null,
            request: {
              canRequest: false,
              remainingRequests: 0,
              eligibilityReason: "already_used_limit",
              eligibleVoterCount: 2,
              requestWindowMs: 24 * 60 * 60 * 1000,
              isWithinWindow: true,
              isActiveMember: true,
            },
          } as never
        }
      />,
    );

    expect(
      screen.getByText(/used both shared extension requests available in this league/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/submission and voting polls spend from the same pool/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/each round only gets 1 voting extension poll/i).length,
    ).toBeGreaterThan(0);
  });

  it("uses submission-specific copy for submission polls", () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    render(
      <ExtensionPollPanel
        pollType="submission"
        roundId={"round-1" as never}
        roundStatus="submissions"
        state={
          {
            type: "submission",
            poll: null,
            request: {
              canRequest: false,
              remainingRequests: 1,
              eligibilityReason: "no_eligible_voters",
              eligibleVoterCount: 0,
              requestWindowMs: 24 * 60 * 60 * 1000,
              isWithinWindow: true,
              isActiveMember: true,
            },
          } as never
        }
      />,
    );

    expect(
      screen.getByText(/submission extension request/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/available during the last 1 day of submission/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/who had already submitted must respond/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /submission extension poll needs at least one member who had already submitted/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows anonymous voting controls for eligible completed voters", () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    render(
      <ExtensionPollPanel
        pollType="voting"
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            type: "voting",
            poll: {
              _id: "poll-1",
              type: "voting",
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

    expect(
      screen.getAllByText("Voting Extension Request").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /grant extension/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /no extension/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/current turnout:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/50% turnout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/closes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^open$/i)).not.toBeInTheDocument();
  });

  it("keeps the panel visible to everyone during the active phase", () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    render(
      <ExtensionPollPanel
        pollType="voting"
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            type: "voting",
            poll: null,
            request: {
              canRequest: false,
              remainingRequests: 2,
              eligibilityReason: "not_authenticated",
              eligibleVoterCount: 0,
              requestWindowMs: 24 * 60 * 60 * 1000,
              isWithinWindow: true,
              isActiveMember: false,
            },
          } as never
        }
      />,
    );

    expect(
      screen.getAllByText("Voting Extension Request").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/this panel is visible to everyone/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request voting extension/i }),
    ).not.toBeInTheDocument();
  });

  it("shows live turnout to members still waiting on the extension result", () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    render(
      <ExtensionPollPanel
        pollType="voting"
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            type: "voting",
            poll: {
              _id: "poll-1",
              type: "voting",
              reason: "I am traveling and need more time to finish listening.",
              status: "open",
              result: "pending",
              openedAt: new Date("2026-04-03T10:00:00Z").getTime(),
              resolvesAt: new Date("2026-04-04T10:00:00Z").getTime(),
              eligibleVoterCount: 4,
              yesVotes: 1,
              noVotes: 0,
              totalVotes: 1,
              minimumTurnout: 2,
              appliedExtensionMs: 0,
              resolvedAt: null,
              currentUserVote: null,
              currentUserEligibleToVote: false,
              canCurrentUserVote: false,
              canCurrentUserSeeLiveVoteCount: true,
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

    expect(screen.getByText(/current turnout:/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 2 votes are needed for the poll to count/i)).toBeInTheDocument();
  });

  it("shows a simple voted message without live totals once a vote is cast", () => {
    vi.mocked(useMutation)
      .mockReturnValueOnce(vi.fn() as never)
      .mockReturnValueOnce(vi.fn() as never);

    render(
      <ExtensionPollPanel
        pollType="voting"
        roundId={"round-1" as never}
        roundStatus="voting"
        state={
          {
            type: "voting",
            poll: {
              _id: "poll-1",
              type: "voting",
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
              currentUserVote: "grant",
              currentUserEligibleToVote: true,
              canCurrentUserVote: false,
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

    expect(screen.getByText(/voted:/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/your anonymous vote is locked in/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Grant")).not.toBeInTheDocument();
    expect(screen.queryByText(/current turnout:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/50% turnout/i)).not.toBeInTheDocument();
  });
});
