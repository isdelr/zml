export const ACCENT_PRESET_IDS = [
  "zml",
  "blue",
  "green",
  "red",
  "pink",
  "purple",
  "cyan",
  "trans",
  "rainbow",
  "lesbian",
] as const;

export type AccentPresetId = (typeof ACCENT_PRESET_IDS)[number];

export type AccentPresetKind = "solid" | "pride";

export type AccentThemeTokens = {
  primary: string;
  primaryForeground: string;
  ring: string;
  accent: string;
  accentForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarRing: string;
  chart1: string;
  accentGradient: string;
};

export type AccentPreset = {
  id: AccentPresetId;
  label: string;
  kind: AccentPresetKind;
  description: string;
  previewStops: readonly string[];
  tokens: {
    light: AccentThemeTokens;
    dark: AccentThemeTokens;
  };
};

export const ACCENT_THEME_STORAGE_KEY = "zml-accent-theme";
export const DEFAULT_ACCENT_THEME: AccentPresetId = "zml";

function createGradient(stops: readonly string[]): string {
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function createSolidPreset(
  id: AccentPresetId,
  label: string,
  hue: number,
  description: string,
): AccentPreset {
  const useDarkForeground = hue >= 120 && hue <= 225;
  const lightPrimary = `oklch(0.64 0.18 ${hue})`;
  const lightAccent = `oklch(0.92 0.035 ${hue})`;
  const darkPrimary = `oklch(0.74 0.15 ${hue})`;
  const darkAccent = `oklch(0.31 0.045 ${hue})`;
  const lightPrimaryForeground = useDarkForeground
    ? "oklch(0.16 0.01 70)"
    : "oklch(0.985 0.003 70)";

  return {
    id,
    label,
    kind: "solid",
    description,
    previewStops: [
      lightPrimary,
      `oklch(0.82 0.09 ${hue})`,
      darkPrimary,
    ],
    tokens: {
      light: {
        primary: lightPrimary,
        primaryForeground: lightPrimaryForeground,
        ring: lightPrimary,
        accent: lightAccent,
        accentForeground: `oklch(0.22 0.02 ${hue})`,
        sidebarPrimary: lightPrimary,
        sidebarPrimaryForeground: lightPrimaryForeground,
        sidebarAccent: `oklch(0.9 0.045 ${hue})`,
        sidebarAccentForeground: `oklch(0.22 0.02 ${hue})`,
        sidebarRing: lightPrimary,
        chart1: lightPrimary,
        accentGradient: createGradient([
          lightPrimary,
          `oklch(0.82 0.09 ${hue})`,
          `oklch(0.9 0.04 ${hue})`,
        ]),
      },
      dark: {
        primary: darkPrimary,
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: darkPrimary,
        accent: darkAccent,
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: darkPrimary,
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: `oklch(0.27 0.05 ${hue})`,
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: darkPrimary,
        chart1: darkPrimary,
        accentGradient: createGradient([
          `oklch(0.78 0.11 ${hue})`,
          darkPrimary,
          `oklch(0.58 0.09 ${hue})`,
        ]),
      },
    },
  };
}

export const ACCENT_PRESETS: Record<AccentPresetId, AccentPreset> = {
  zml: {
    id: "zml",
    label: "ZML",
    kind: "solid",
    description: "The original warm orange accent.",
    previewStops: [
      "oklch(0.65 0.2 55)",
      "oklch(0.78 0.12 70)",
      "oklch(0.73 0.19 55)",
    ],
    tokens: {
      light: {
        primary: "oklch(0.65 0.2 55)",
        primaryForeground: "oklch(0.99 0.002 70)",
        ring: "oklch(0.65 0.2 55)",
        accent: "oklch(0.88 0.015 70)",
        accentForeground: "oklch(0.15 0.01 70)",
        sidebarPrimary: "oklch(0.65 0.2 55)",
        sidebarPrimaryForeground: "oklch(0.99 0.002 70)",
        sidebarAccent: "oklch(0.88 0.015 70)",
        sidebarAccentForeground: "oklch(0.15 0.01 70)",
        sidebarRing: "oklch(0.65 0.2 55)",
        chart1: "oklch(0.65 0.2 55)",
        accentGradient: createGradient([
          "oklch(0.65 0.2 55)",
          "oklch(0.76 0.14 70)",
          "oklch(0.88 0.035 55)",
        ]),
      },
      dark: {
        primary: "oklch(0.73 0.19 55)",
        primaryForeground: "oklch(0.15 0.01 70)",
        ring: "oklch(0.73 0.19 55)",
        accent: "oklch(0.27 0.02 70)",
        accentForeground: "oklch(0.93 0.005 70)",
        sidebarPrimary: "oklch(0.73 0.19 55)",
        sidebarPrimaryForeground: "oklch(0.15 0.01 70)",
        sidebarAccent: "oklch(0.22 0.02 70)",
        sidebarAccentForeground: "oklch(0.93 0.005 70)",
        sidebarRing: "oklch(0.73 0.19 55)",
        chart1: "oklch(0.73 0.19 55)",
        accentGradient: createGradient([
          "oklch(0.78 0.12 68)",
          "oklch(0.73 0.19 55)",
          "oklch(0.58 0.11 46)",
        ]),
      },
    },
  },
  blue: createSolidPreset("blue", "Blue", 255, "Electric but balanced cobalt."),
  green: createSolidPreset("green", "Green", 155, "Fresh emerald for calm highlights."),
  red: createSolidPreset("red", "Red", 25, "Bold scarlet with restrained dark tones."),
  pink: createSolidPreset("pink", "Pink", 350, "Bright rose for playful accents."),
  purple: createSolidPreset("purple", "Purple", 305, "Violet leaning slightly magenta."),
  cyan: createSolidPreset("cyan", "Cyan", 215, "Cool aqua with strong contrast."),
  trans: {
    id: "trans",
    label: "Trans",
    kind: "pride",
    description: "Blue-led controls with a trans pride preview.",
    previewStops: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"],
    tokens: {
      light: {
        primary: "oklch(0.66 0.15 235)",
        primaryForeground: "oklch(0.985 0.003 70)",
        ring: "oklch(0.66 0.15 235)",
        accent: "oklch(0.92 0.03 235)",
        accentForeground: "oklch(0.2 0.015 235)",
        sidebarPrimary: "oklch(0.66 0.15 235)",
        sidebarPrimaryForeground: "oklch(0.985 0.003 70)",
        sidebarAccent: "oklch(0.9 0.04 235)",
        sidebarAccentForeground: "oklch(0.2 0.015 235)",
        sidebarRing: "oklch(0.66 0.15 235)",
        chart1: "oklch(0.66 0.15 235)",
        accentGradient: createGradient([
          "#5BCEFA",
          "#F5A9B8",
          "#FFFFFF",
          "#F5A9B8",
          "#5BCEFA",
        ]),
      },
      dark: {
        primary: "oklch(0.75 0.13 235)",
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: "oklch(0.75 0.13 235)",
        accent: "oklch(0.31 0.04 235)",
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: "oklch(0.75 0.13 235)",
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: "oklch(0.28 0.045 235)",
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: "oklch(0.75 0.13 235)",
        chart1: "oklch(0.75 0.13 235)",
        accentGradient: createGradient([
          "#5BCEFA",
          "#F5A9B8",
          "#FFFFFF",
          "#F5A9B8",
          "#5BCEFA",
        ]),
      },
    },
  },
  rainbow: {
    id: "rainbow",
    label: "Rainbow",
    kind: "pride",
    description: "Blue-violet controls with a classic rainbow sweep.",
    previewStops: ["#E40303", "#FF8C00", "#FFED00", "#008026", "#24408E", "#732982"],
    tokens: {
      light: {
        primary: "oklch(0.62 0.17 285)",
        primaryForeground: "oklch(0.985 0.003 70)",
        ring: "oklch(0.62 0.17 285)",
        accent: "oklch(0.91 0.035 285)",
        accentForeground: "oklch(0.21 0.02 285)",
        sidebarPrimary: "oklch(0.62 0.17 285)",
        sidebarPrimaryForeground: "oklch(0.985 0.003 70)",
        sidebarAccent: "oklch(0.89 0.045 285)",
        sidebarAccentForeground: "oklch(0.21 0.02 285)",
        sidebarRing: "oklch(0.62 0.17 285)",
        chart1: "oklch(0.62 0.17 285)",
        accentGradient: createGradient([
          "#E40303",
          "#FF8C00",
          "#FFED00",
          "#008026",
          "#24408E",
          "#732982",
        ]),
      },
      dark: {
        primary: "oklch(0.72 0.15 285)",
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: "oklch(0.72 0.15 285)",
        accent: "oklch(0.3 0.05 285)",
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: "oklch(0.72 0.15 285)",
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: "oklch(0.27 0.05 285)",
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: "oklch(0.72 0.15 285)",
        chart1: "oklch(0.72 0.15 285)",
        accentGradient: createGradient([
          "#E40303",
          "#FF8C00",
          "#FFED00",
          "#008026",
          "#24408E",
          "#732982",
        ]),
      },
    },
  },
  lesbian: {
    id: "lesbian",
    label: "Lesbian",
    kind: "pride",
    description: "Rose-coral controls with a lesbian pride preview.",
    previewStops: [
      "#D52D00",
      "#EF7627",
      "#FF9A56",
      "#FFFFFF",
      "#D362A4",
      "#B55690",
      "#A30262",
    ],
    tokens: {
      light: {
        primary: "oklch(0.64 0.18 18)",
        primaryForeground: "oklch(0.985 0.003 70)",
        ring: "oklch(0.64 0.18 18)",
        accent: "oklch(0.92 0.035 18)",
        accentForeground: "oklch(0.21 0.02 18)",
        sidebarPrimary: "oklch(0.64 0.18 18)",
        sidebarPrimaryForeground: "oklch(0.985 0.003 70)",
        sidebarAccent: "oklch(0.9 0.045 18)",
        sidebarAccentForeground: "oklch(0.21 0.02 18)",
        sidebarRing: "oklch(0.64 0.18 18)",
        chart1: "oklch(0.64 0.18 18)",
        accentGradient: createGradient([
          "#D52D00",
          "#EF7627",
          "#FF9A56",
          "#FFFFFF",
          "#D362A4",
          "#B55690",
          "#A30262",
        ]),
      },
      dark: {
        primary: "oklch(0.73 0.16 18)",
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: "oklch(0.73 0.16 18)",
        accent: "oklch(0.31 0.05 18)",
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: "oklch(0.73 0.16 18)",
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: "oklch(0.28 0.05 18)",
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: "oklch(0.73 0.16 18)",
        chart1: "oklch(0.73 0.16 18)",
        accentGradient: createGradient([
          "#D52D00",
          "#EF7627",
          "#FF9A56",
          "#FFFFFF",
          "#D362A4",
          "#B55690",
          "#A30262",
        ]),
      },
    },
  },
};

export const ACCENT_PRESET_LIST = ACCENT_PRESET_IDS.map(
  (presetId) => ACCENT_PRESETS[presetId],
);

const ACCENT_TOKEN_VARIABLES: Record<keyof AccentThemeTokens, string> = {
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  ring: "--ring",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarRing: "--sidebar-ring",
  chart1: "--chart-1",
  accentGradient: "--accent-gradient",
};

function buildTokenLines(tokens: AccentThemeTokens): string {
  return (
    Object.entries(ACCENT_TOKEN_VARIABLES) as Array<
      [keyof AccentThemeTokens, string]
    >
  )
    .map(([tokenName, cssVariable]) => `${cssVariable}: ${tokens[tokenName]};`)
    .join("\n");
}

export function isAccentPresetId(
  value: string | null | undefined,
): value is AccentPresetId {
  return (
    typeof value === "string" &&
    (ACCENT_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function getAccentPreviewBackground(preset: AccentPreset): string {
  return createGradient(preset.previewStops);
}

export function getAccentThemeBootScript(): string {
  const presetIds = JSON.stringify(ACCENT_PRESET_IDS);
  return `
(() => {
  const storageKey = ${JSON.stringify(ACCENT_THEME_STORAGE_KEY)};
  const fallback = ${JSON.stringify(DEFAULT_ACCENT_THEME)};
  const allowed = new Set(${presetIds});

  try {
    const saved = window.localStorage.getItem(storageKey);
    const accentTheme = saved && allowed.has(saved) ? saved : fallback;
    document.documentElement.dataset.accentTheme = accentTheme;
  } catch {
    document.documentElement.dataset.accentTheme = fallback;
  }
})();
`.trim();
}

export const ACCENT_THEME_CSS = ACCENT_PRESET_LIST.flatMap((preset) => [
  `html[data-accent-theme="${preset.id}"] {\n${buildTokenLines(preset.tokens.light)}\n}`,
  `html.dark[data-accent-theme="${preset.id}"] {\n${buildTokenLines(preset.tokens.dark)}\n}`,
]).join("\n\n");
