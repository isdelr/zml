import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoundStatusAlerts } from "@/components/round/RoundStatusAlerts";

describe("RoundStatusAlerts", () => {
  it("shows a late-join listen-only message", () => {
    render(
      <RoundStatusAlerts
        isSpectator={false}
        roundStatus="voting"
        userVoteStatus={
          {
            hasVoted: false,
            canVote: false,
            eligibilityReason: "joined_late",
          } as never
        }
        enforceListenPercentage={true}
        songsLeftToListenCount={3}
      />,
    );

    expect(screen.getByText("Round Already Underway")).toBeInTheDocument();
    expect(
      screen.getByText(/this round is listen-only for you/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Listening Requirement")).not.toBeInTheDocument();
  });
});
