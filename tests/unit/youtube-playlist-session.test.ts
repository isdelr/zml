import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRoundYouTubePlaylistSessionSnapshot,
  openUrlInNewTabWithFallback,
  startRoundYouTubePlaylistSession,
} from "@/lib/music/youtube-playlist-session";

describe("youtube playlist session helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts a round session and reuses an active timer", () => {
    const sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    sessionStorage.getItem.mockImplementation((key: string) => {
      if (key.endsWith(":opened")) return "1";
      if (key.endsWith(":endAt")) return String(1700000000000);
      if (key.endsWith(":duration")) return "240";
      return null;
    });

    const session = startRoundYouTubePlaylistSession("round-1", 240, {
      now: 1699999990000,
      sessionStorage,
      localStorage,
    });

    expect(session.active).toBe(true);
    expect(session.remainingSec).toBe(10);
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "ytPlaylist:round-1:opened",
      "1",
    );
    expect(sessionStorage.setItem).not.toHaveBeenCalledWith(
      "ytPlaylist:round-1:endAt",
      expect.any(String),
    );
  });

  it("returns done when the round session was already completed", () => {
    const snapshot = startRoundYouTubePlaylistSession("round-1", 240, {
      sessionStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      localStorage: {
        getItem: vi.fn((key: string) =>
          key.endsWith(":done") ? "1" : null,
        ),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    expect(snapshot.done).toBe(true);
    expect(snapshot.active).toBe(false);
  });

  it("reads a missing session as inactive", () => {
    const snapshot = getRoundYouTubePlaylistSessionSnapshot("round-1", {
      sessionStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      now: 1700000000000,
    });

    expect(snapshot).toMatchObject({
      active: false,
      done: false,
      opened: false,
      remainingSec: 0,
    });
  });

  it("does not redirect the current tab when popups are blocked", () => {
    const assign = vi.fn();
    const open = vi.fn(() => null);

    vi.stubGlobal("window", {
      open,
      location: { assign },
    });

    expect(openUrlInNewTabWithFallback("https://example.com")).toBe(false);
    expect(open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("redirects the current tab when the caller opts into fallback navigation", () => {
    const assign = vi.fn();
    const open = vi.fn(() => null);

    vi.stubGlobal("window", {
      open,
      location: { assign },
    });

    expect(
      openUrlInNewTabWithFallback("https://example.com", {
        fallbackToCurrentTab: true,
      }),
    ).toBe(true);
    expect(assign).toHaveBeenCalledWith("https://example.com");
  });
});
