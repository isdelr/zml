import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceSettingsDialog } from "@/components/AppearanceSettingsDialog";
import { AccentThemeProvider } from "@/components/providers/AccentThemeProvider";
import { ACCENT_THEME_STORAGE_KEY } from "@/lib/theme/accent-theme";

const setThemeMock = vi.fn();
let themeValue: string | undefined = "system";

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

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: themeValue,
    setTheme: setThemeMock,
  }),
}));

function renderDialog() {
  return render(
    <AccentThemeProvider>
      <AppearanceSettingsDialog />
    </AccentThemeProvider>,
  );
}

beforeEach(() => {
  installStorageMock();
  themeValue = "system";
  setThemeMock.mockReset();
  window.localStorage.clear();
  delete document.documentElement.dataset.accentTheme;
});

afterEach(() => {
  cleanup();
  document.body.style.pointerEvents = "";
  window.localStorage.clear();
  delete document.documentElement.dataset.accentTheme;
});

describe("AppearanceSettingsDialog", () => {
  it("opens from a settings cog trigger and routes theme mode changes to next-themes", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: /open appearance settings/i }),
    );
    await user.click(screen.getByRole("button", { name: /^dark$/i }));

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("updates the accent preset selection and preview state", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: /open appearance settings/i }),
    );

    const cyanPreset = screen.getByRole("button", {
      name: /cyan cool aqua with strong contrast/i,
    });
    await user.click(cyanPreset);

    await waitFor(() => {
      expect(document.documentElement.dataset.accentTheme).toBe("cyan");
    });

    expect(window.localStorage.getItem(ACCENT_THEME_STORAGE_KEY)).toBe("cyan");
    expect(cyanPreset).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Current preset: Cyan")).toBeInTheDocument();
  });
});
