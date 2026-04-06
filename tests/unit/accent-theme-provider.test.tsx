import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AccentThemeProvider,
  useAccentTheme,
} from "@/components/providers/AccentThemeProvider";
import {
  ACCENT_THEME_STORAGE_KEY,
  DEFAULT_ACCENT_THEME,
} from "@/lib/theme/accent-theme";

function installStorageMock() {
  const storage = new Map<string, string>();

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AccentThemeProvider>{children}</AccentThemeProvider>;
}

installStorageMock();

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.accentTheme;
});

describe("AccentThemeProvider", () => {
  it("restores the default accent when storage is empty", async () => {
    const { result } = renderHook(() => useAccentTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.accentTheme).toBe(DEFAULT_ACCENT_THEME);
    });

    expect(document.documentElement.dataset.accentTheme).toBe(
      DEFAULT_ACCENT_THEME,
    );
    expect(window.localStorage.getItem(ACCENT_THEME_STORAGE_KEY)).toBe(
      DEFAULT_ACCENT_THEME,
    );
  });

  it("restores a saved accent theme from localStorage", async () => {
    window.localStorage.setItem(ACCENT_THEME_STORAGE_KEY, "cyan");

    const { result } = renderHook(() => useAccentTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.accentTheme).toBe("cyan");
    });

    expect(document.documentElement.dataset.accentTheme).toBe("cyan");
  });

  it("updates the html data attribute immediately when the accent changes", async () => {
    const { result } = renderHook(() => useAccentTheme(), { wrapper });

    act(() => {
      result.current.setAccentTheme("pink");
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.accentTheme).toBe("pink");
    });

    expect(window.localStorage.getItem(ACCENT_THEME_STORAGE_KEY)).toBe("pink");
  });
});
