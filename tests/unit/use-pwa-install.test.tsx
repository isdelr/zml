import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePWAInstall } from "@/hooks/usePWAInstall";

type MatchMediaState = {
  isMobile: boolean;
  isStandalone?: boolean;
};

function mockMatchMedia({ isMobile, isStandalone = false }: MatchMediaState) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        query === "(max-width: 767px)"
          ? isMobile
          : query === "(display-mode: standalone)"
            ? isStandalone
            : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

function createBeforeInstallPromptEvent() {
  const event = new Event("beforeinstallprompt", {
    bubbles: true,
    cancelable: true,
  }) as Event & {
    platforms: string[];
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
  };

  Object.assign(event, {
    platforms: ["web"],
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({
      outcome: "dismissed" as const,
      platform: "web",
    }),
  });

  return event;
}

describe("usePWAInstall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    const localStorageMock = createStorageMock();
    vi.stubGlobal("localStorage", localStorageMock);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
    localStorageMock.clear();
    mockMatchMedia({ isMobile: true });
  });

  it("defers the browser prompt when the custom mobile banner can be shown", async () => {
    const { result } = renderHook(() => usePWAInstall());
    const event = createBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(result.current.isBannerVisible).toBe(true);
    });

    await act(async () => {
      await result.current.handleInstallClick();
    });

    expect(event.prompt).toHaveBeenCalledOnce();
  });

  it("does not suppress the browser prompt on desktop viewports", async () => {
    mockMatchMedia({ isMobile: false });
    const { result } = renderHook(() => usePWAInstall());
    const event = createBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(result.current.isBannerVisible).toBe(false);
    });

    await act(async () => {
      await result.current.handleInstallClick();
    });

    expect(event.prompt).not.toHaveBeenCalled();
  });

  it("does not suppress the browser prompt after the custom banner has been dismissed", async () => {
    localStorage.setItem(
      "pwa-prompt-dismissed-timestamp",
      Date.now().toString(),
    );
    const { result } = renderHook(() => usePWAInstall());
    const event = createBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(result.current.isBannerVisible).toBe(false);
    });

    await act(async () => {
      await result.current.handleInstallClick();
    });

    expect(event.prompt).not.toHaveBeenCalled();
  });
});
