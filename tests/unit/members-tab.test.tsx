import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/convex/api";
import { MembersTab } from "@/components/league/settings/MembersTab";

const kickMemberMock = vi.fn();
const setMemberListenRequirementVoidedMock = vi.fn();
const toastPromiseMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: vi.fn((mutation) => {
    if (mutation === api.leagues.kickMember) {
      return kickMemberMock;
    }

    if (mutation === api.leagues.setMemberListenRequirementVoided) {
      return setMemberListenRequirementVoidedMock;
    }

    return vi.fn();
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: (...args: unknown[]) => toastPromiseMock(...args),
  },
}));

vi.mock("@/components/ui/dropdown-menu", async () => {
  const React = await import("react");
  const DropdownMenuContext = React.createContext<{
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  } | null>(null);

  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => {
      const [open, setOpen] = React.useState(false);
      return (
        <DropdownMenuContext.Provider value={{ open, setOpen }}>
          <div>{children}</div>
        </DropdownMenuContext.Provider>
      );
    },
    DropdownMenuTrigger: ({
      children,
      asChild,
    }: {
      children: ReactNode;
      asChild?: boolean;
    }) => {
      const context = React.useContext(DropdownMenuContext);
      const child = React.Children.only(children) as React.ReactElement<{
        onClick?: () => void;
      }>;

      if (!asChild || !context) {
        return <>{children}</>;
      }

      return React.cloneElement(child, {
        onClick: () => context.setOpen((previous) => !previous),
      });
    },
    DropdownMenuContent: ({ children }: { children: ReactNode }) => {
      const context = React.useContext(DropdownMenuContext);
      if (!context?.open) return null;
      return <div role="menu">{children}</div>;
    },
    DropdownMenuItem: ({
      children,
      onSelect,
    }: {
      children: ReactNode;
      onSelect?: () => void;
    }) => (
      <button type="button" role="menuitem" onClick={onSelect}>
        {children}
      </button>
    ),
    DropdownMenuSeparator: () => <hr />,
  };
});

describe("MembersTab", () => {
  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
    document.body.removeAttribute("data-scroll-locked");
  });

  beforeEach(() => {
    kickMemberMock.mockReset();
    setMemberListenRequirementVoidedMock.mockReset();
    toastPromiseMock.mockReset();
    kickMemberMock.mockResolvedValue("Member kicked.");
    setMemberListenRequirementVoidedMock.mockResolvedValue({
      success: true,
      message: "Listening requirement updated.",
    });
  });

  it("asks for confirmation before kicking a member from the context menu", async () => {
    const user = userEvent.setup();

    render(
      <MembersTab
        league={
          {
            _id: "league-1",
            creatorId: "owner-1",
            canManageLeague: true,
            members: [
              { _id: "owner-1", name: "Owner", image: null },
              { _id: "member-1", name: "Member One", image: null },
            ],
            spectators: [],
          } as never
        }
      />,
    );

    expect(screen.queryByRole("button", { name: "Kick" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Actions for Member One" }),
    );
    await user.click(screen.getByRole("menuitem", { name: /kick/i }));

    expect(screen.getByText("Kick member?")).toBeInTheDocument();
    expect(
      screen.getByText("Remove Member One from this league?"),
    ).toBeInTheDocument();
    expect(kickMemberMock).not.toHaveBeenCalled();
  });

  it("shows owner and manager actions through the context menu", async () => {
    const user = userEvent.setup();

    render(
      <MembersTab
        league={
          {
            _id: "league-1",
            creatorId: "owner-1",
            canManageLeague: true,
            members: [
              { _id: "owner-1", name: "Owner", image: null },
              { _id: "member-1", name: "Member One", image: null },
            ],
            spectators: [],
          } as never
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for Owner" }));

    expect(
      screen.getByRole("menuitem", { name: /void listening requirement/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /kick/i })).not.toBeInTheDocument();
  });

  it("renders the exemption badge and restore copy for exempt members", async () => {
    const user = userEvent.setup();

    render(
      <MembersTab
        league={
          {
            _id: "league-1",
            creatorId: "owner-1",
            canManageLeague: true,
            members: [
              {
                _id: "member-1",
                name: "Member One",
                image: null,
                listenRequirementVoided: true,
              },
            ],
            spectators: [],
          } as never
        }
      />,
    );

    expect(screen.getByText("Listen exempt")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Actions for Member One" }),
    );

    expect(
      screen.getByRole("menuitem", { name: /restore listening requirement/i }),
    ).toBeInTheDocument();
  });

  it("does not show the listen override action for spectators", async () => {
    const user = userEvent.setup();

    render(
      <MembersTab
        league={
          {
            _id: "league-1",
            creatorId: "owner-1",
            canManageLeague: true,
            members: [],
            spectators: [{ _id: "spectator-1", name: "Spectator", image: null }],
          } as never
        }
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Actions for Spectator" }),
    );

    expect(screen.queryByText(/void listening requirement/i)).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /kick/i })).toBeInTheDocument();
  });
});
