"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ACCENT_THEME_STORAGE_KEY,
  DEFAULT_ACCENT_THEME,
  isAccentPresetId,
  type AccentPresetId,
} from "@/lib/theme/accent-theme";

type AccentThemeContextValue = {
  accentTheme: AccentPresetId;
  setAccentTheme: (accentTheme: AccentPresetId) => void;
};

const AccentThemeContext = createContext<AccentThemeContextValue | null>(null);

function readStoredAccentTheme(): AccentPresetId {
  if (typeof document !== "undefined") {
    const themeFromDom = document.documentElement.dataset.accentTheme;
    if (isAccentPresetId(themeFromDom)) {
      return themeFromDom;
    }
  }

  if (typeof window !== "undefined") {
    try {
      const storedTheme = window.localStorage.getItem(ACCENT_THEME_STORAGE_KEY);
      if (isAccentPresetId(storedTheme)) {
        return storedTheme;
      }
    } catch {
      // Ignore storage access failures and fall back to the default theme.
    }
  }

  return DEFAULT_ACCENT_THEME;
}

function persistAccentTheme(accentTheme: AccentPresetId) {
  document.documentElement.dataset.accentTheme = accentTheme;

  try {
    window.localStorage.setItem(ACCENT_THEME_STORAGE_KEY, accentTheme);
  } catch {
    // Ignore storage failures in private browsing / restricted contexts.
  }
}

export function AccentThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accentTheme, setAccentThemeState] = useState<AccentPresetId>(() =>
    readStoredAccentTheme(),
  );

  useEffect(() => {
    persistAccentTheme(accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACCENT_THEME_STORAGE_KEY) {
        return;
      }

      setAccentThemeState(
        isAccentPresetId(event.newValue)
          ? event.newValue
          : DEFAULT_ACCENT_THEME,
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setAccentTheme = useCallback((nextAccentTheme: AccentPresetId) => {
    setAccentThemeState(nextAccentTheme);
  }, []);

  const value = useMemo(
    () => ({ accentTheme, setAccentTheme }),
    [accentTheme, setAccentTheme],
  );

  return (
    <AccentThemeContext.Provider value={value}>
      {children}
    </AccentThemeContext.Provider>
  );
}

export function useAccentTheme() {
  const context = useContext(AccentThemeContext);

  if (!context) {
    throw new Error("useAccentTheme must be used within an AccentThemeProvider");
  }

  return context;
}
