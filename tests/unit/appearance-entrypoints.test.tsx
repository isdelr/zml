import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/Sidebar";
import { MobileMenuSheet } from "@/components/MobileMenuSheet";

vi.mock("@/components/AppearanceSettingsDialog", () => ({
  AppearanceSettingsDialog: () => (
    <button type="button" data-testid="appearance-settings-dialog">
      Appearance dialog
    </button>
  ),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (query: string) => {
    if (query === "getCurrentUser") {
      return { _id: "user-1", name: "Test User", image: null };
    }

    if (query === "getLeaguesForUserFiltered") {
      return [];
    }

    if (query === "getUnreadCount") {
      return 0;
    }

    return undefined;
  },
}));

vi.mock("@/lib/convex/api", () => ({
  api: {
    users: {
      getCurrentUser: "getCurrentUser",
    },
    leagues: {
      getLeaguesForUserFiltered: "getLeaguesForUserFiltered",
    },
    notifications: {
      getUnreadCount: "getUnreadCount",
    },
  },
}));

vi.mock("@/hooks/useMusicPlayerStore", () => ({
  useMusicPlayerStore: (selector: (state: unknown) => unknown) =>
    selector({
      actions: { clearQueue: vi.fn() },
      currentTrackIndex: null,
    }),
}));

vi.mock("@/lib/auth-client", () => ({
  signOutFromApp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
}));

vi.mock("jdenticon", () => ({
  toSvg: () => "<svg></svg>",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("appearance entrypoints", () => {
  it("renders the appearance dialog trigger in the desktop sidebar", () => {
    render(<Sidebar />);

    expect(
      screen.getByTestId("appearance-settings-dialog"),
    ).toBeInTheDocument();
  });

  it("renders the appearance dialog trigger and label in the mobile menu", () => {
    render(<MobileMenuSheet isOpen={true} onOpenChange={vi.fn()} />);

    expect(screen.getAllByTestId("appearance-settings-dialog")).toHaveLength(1);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
