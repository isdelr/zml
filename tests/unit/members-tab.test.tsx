import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MembersTab } from "@/components/league/settings/MembersTab";

const kickMemberMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => kickMemberMock),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

describe("MembersTab", () => {
  beforeEach(() => {
    kickMemberMock.mockReset();
    kickMemberMock.mockResolvedValue("Member kicked.");
  });

  it("asks for confirmation before kicking a member", async () => {
    const user = userEvent.setup();

    render(
      <MembersTab
        league={
          {
            _id: "league-1",
            creatorId: "owner-1",
            members: [
              { _id: "owner-1", name: "Owner", image: null },
              { _id: "member-1", name: "Member One", image: null },
            ],
            spectators: [],
          } as never
        }
        currentUser={{ _id: "owner-1" } as never}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Kick" }));

    expect(screen.getByText("Kick member?")).toBeInTheDocument();
    expect(
      screen.getByText("Remove Member One from this league?"),
    ).toBeInTheDocument();
    expect(kickMemberMock).not.toHaveBeenCalled();

    expect(kickMemberMock).not.toHaveBeenCalled();
  });
});
