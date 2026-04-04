import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/components/SignInPage";

const { signInWithDiscordMock } = vi.hoisted(() => ({
  signInWithDiscordMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  signInWithDiscord: signInWithDiscordMock,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    signInWithDiscordMock.mockReset();
  });

  it("disables the sign-in button and avoids duplicate requests while redirecting", async () => {
    const user = userEvent.setup();
    signInWithDiscordMock.mockImplementation(() => new Promise(() => {}));

    render(<SignInPage redirectUrl="/leagues/demo" />);

    const button = screen.getByRole("button", { name: /sign in with discord/i });
    await user.click(button);

    expect(signInWithDiscordMock).toHaveBeenCalledWith("/leagues/demo");
    expect(
      screen.getByRole("button", { name: /redirecting/i }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /redirecting/i }));
    expect(signInWithDiscordMock).toHaveBeenCalledTimes(1);
  });

  it("shows a friendly error and re-enables the button when sign-in startup fails", async () => {
    const user = userEvent.setup();
    signInWithDiscordMock.mockRejectedValue(new Error("oauth failed"));

    render(<SignInPage redirectUrl="/explore" />);

    await user.click(
      screen.getByRole("button", { name: /sign in with discord/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't start Discord sign-in. Please try again."),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /sign in with discord/i }),
    ).toBeEnabled();
  });
});
