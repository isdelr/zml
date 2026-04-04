import { beforeEach, describe, expect, it, vi } from "vitest";

const { socialMock, signOutMock, convexClientMock } = vi.hoisted(() => ({
  socialMock: vi.fn(),
  signOutMock: vi.fn(),
  convexClientMock: vi.fn(() => ({})),
}));

vi.mock("@convex-dev/better-auth/client/plugins", () => ({
  convexClient: convexClientMock,
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    signIn: {
      social: socialMock,
    },
    signOut: signOutMock,
  })),
}));

import {
  authNavigation,
  extractAuthRedirectUrl,
  normalizeCallbackPath,
  signInWithDiscord,
} from "@/lib/auth-client";

describe("auth-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    socialMock.mockReset();
    signOutMock.mockReset();
    convexClientMock.mockClear();
  });

  it("normalizes callback paths to same-origin routes", () => {
    expect(normalizeCallbackPath("/leagues/abc")).toBe("/leagues/abc");
    expect(normalizeCallbackPath("https://evil.example/steal")).toBe(
      "/explore",
    );
    expect(normalizeCallbackPath("//evil.example/steal")).toBe("/explore");
  });

  it("extracts redirect URLs from Better Auth responses", () => {
    expect(extractAuthRedirectUrl("https://discord.example/start")).toBe(
      "https://discord.example/start",
    );
    expect(
      extractAuthRedirectUrl({
        url: "https://discord.example/direct",
      }),
    ).toBe("https://discord.example/direct");
    expect(
      extractAuthRedirectUrl({
        data: {
          url: "https://discord.example/nested",
        },
      }),
    ).toBe("https://discord.example/nested");
  });

  it("sanitizes callback URLs and manually redirects after social sign-in", async () => {
    const assignMock = vi
      .spyOn(authNavigation, "assign")
      .mockImplementation(() => undefined);

    socialMock.mockResolvedValue({
      data: {
        url: "https://discord.example/oauth",
      },
    });

    await signInWithDiscord("https://evil.example/steal");

    expect(socialMock).toHaveBeenCalledWith({
      provider: "discord",
      callbackURL: "/explore",
      errorCallbackURL: "/signin?redirect_url=%2Fexplore",
      disableRedirect: true,
    });
    expect(assignMock).toHaveBeenCalledWith("https://discord.example/oauth");
  });

  it("suppresses duplicate sign-in requests while one is already in flight", async () => {
    const assignMock = vi
      .spyOn(authNavigation, "assign")
      .mockImplementation(() => undefined);

    let resolveSignIn:
      | ((value: { data: { url: string } }) => void)
      | undefined;
    socialMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    const first = signInWithDiscord("/invite/abc");
    const second = signInWithDiscord("/invite/abc");

    expect(socialMock).toHaveBeenCalledTimes(1);

    if (!resolveSignIn) {
      throw new Error("Expected sign-in promise resolver to be set.");
    }

    resolveSignIn({
      data: {
        url: "https://discord.example/oauth",
      },
    });

    await Promise.all([first, second]);

    expect(assignMock).toHaveBeenCalledTimes(1);
  });

  it("throws a friendly error when the auth response does not include a redirect URL", async () => {
    const assignMock = vi
      .spyOn(authNavigation, "assign")
      .mockImplementation(() => undefined);

    socialMock.mockResolvedValue({
      data: {
        redirect: false,
      },
    });

    await expect(signInWithDiscord("/signin")).rejects.toThrow(
      "Discord sign-in could not start. Please try again.",
    );
    expect(assignMock).not.toHaveBeenCalled();
  });
});
