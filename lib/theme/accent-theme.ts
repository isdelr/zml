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
  surfaceHue: string;
  primary: string;
  primaryForeground: string;
  ring: string;
  destructive: string;
  success: string;
  warning: string;
  info: string;
  highlight: string;
  accent: string;
  accentForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarRing: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  accentGradient: string;
  interactiveGradient: string;
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

function createDirectionalGradient(
  stops: readonly string[],
  angle = "145deg",
): string {
  return `linear-gradient(${angle}, ${stops.join(", ")})`;
}

function normalizeHue(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function mixHue(from: number, to: number, amount: number): number {
  const normalizedFrom = normalizeHue(from);
  const normalizedTo = normalizeHue(to);
  let delta = normalizedTo - normalizedFrom;

  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }

  return normalizeHue(normalizedFrom + delta * amount);
}

function createStateTokens(hue: number) {
  const successHue = mixHue(hue, 150, 0.42);
  const warningHue = mixHue(hue, 85, 0.48);
  const infoHue = mixHue(hue, 245, 0.24);
  const highlightHue = mixHue(hue, 300, 0.42);
  const destructiveHue = mixHue(hue, 20, 0.58);

  return {
    light: {
      destructive: `oklch(0.56 0.18 ${destructiveHue})`,
      success: `oklch(0.57 0.15 ${successHue})`,
      warning: `oklch(0.72 0.13 ${warningHue})`,
      info: `oklch(0.58 0.14 ${infoHue})`,
      highlight: `oklch(0.61 0.15 ${highlightHue})`,
      chart2: `oklch(0.57 0.15 ${successHue})`,
      chart3: `oklch(0.61 0.15 ${highlightHue})`,
      chart4: `oklch(0.72 0.13 ${warningHue})`,
      chart5: `oklch(0.56 0.18 ${destructiveHue})`,
    },
    dark: {
      destructive: `oklch(0.66 0.16 ${destructiveHue})`,
      success: `oklch(0.69 0.14 ${successHue})`,
      warning: `oklch(0.79 0.13 ${warningHue})`,
      info: `oklch(0.69 0.13 ${infoHue})`,
      highlight: `oklch(0.7 0.14 ${highlightHue})`,
      chart2: `oklch(0.69 0.14 ${successHue})`,
      chart3: `oklch(0.7 0.14 ${highlightHue})`,
      chart4: `oklch(0.79 0.13 ${warningHue})`,
      chart5: `oklch(0.66 0.16 ${destructiveHue})`,
    },
  };
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
  const stateTokens = createStateTokens(hue);

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
        surfaceHue: `${hue}`,
        primary: lightPrimary,
        primaryForeground: lightPrimaryForeground,
        ring: lightPrimary,
        destructive: stateTokens.light.destructive,
        success: stateTokens.light.success,
        warning: stateTokens.light.warning,
        info: stateTokens.light.info,
        highlight: stateTokens.light.highlight,
        accent: lightAccent,
        accentForeground: `oklch(0.22 0.02 ${hue})`,
        sidebarPrimary: lightPrimary,
        sidebarPrimaryForeground: lightPrimaryForeground,
        sidebarAccent: `oklch(0.9 0.045 ${hue})`,
        sidebarAccentForeground: `oklch(0.22 0.02 ${hue})`,
        sidebarRing: lightPrimary,
        chart1: lightPrimary,
        chart2: stateTokens.light.chart2,
        chart3: stateTokens.light.chart3,
        chart4: stateTokens.light.chart4,
        chart5: stateTokens.light.chart5,
        accentGradient: createGradient([
          lightPrimary,
          `oklch(0.82 0.09 ${hue})`,
          `oklch(0.9 0.04 ${hue})`,
        ]),
        interactiveGradient: createGradient([lightPrimary, lightPrimary]),
      },
      dark: {
        surfaceHue: `${hue}`,
        primary: darkPrimary,
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: darkPrimary,
        destructive: stateTokens.dark.destructive,
        success: stateTokens.dark.success,
        warning: stateTokens.dark.warning,
        info: stateTokens.dark.info,
        highlight: stateTokens.dark.highlight,
        accent: darkAccent,
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: darkPrimary,
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: `oklch(0.27 0.05 ${hue})`,
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: darkPrimary,
        chart1: darkPrimary,
        chart2: stateTokens.dark.chart2,
        chart3: stateTokens.dark.chart3,
        chart4: stateTokens.dark.chart4,
        chart5: stateTokens.dark.chart5,
        accentGradient: createGradient([
          `oklch(0.78 0.11 ${hue})`,
          darkPrimary,
          `oklch(0.58 0.09 ${hue})`,
        ]),
        interactiveGradient: createGradient([darkPrimary, darkPrimary]),
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
        surfaceHue: "55",
        primary: "oklch(0.65 0.2 55)",
        primaryForeground: "oklch(0.99 0.002 70)",
        ring: "oklch(0.65 0.2 55)",
        destructive: "oklch(0.55 0.22 27)",
        success: "oklch(0.55 0.18 150)",
        warning: "oklch(0.70 0.16 85)",
        info: "oklch(0.55 0.16 245)",
        highlight: "oklch(0.55 0.18 300)",
        accent: "oklch(0.88 0.015 70)",
        accentForeground: "oklch(0.15 0.01 70)",
        sidebarPrimary: "oklch(0.65 0.2 55)",
        sidebarPrimaryForeground: "oklch(0.99 0.002 70)",
        sidebarAccent: "oklch(0.88 0.015 70)",
        sidebarAccentForeground: "oklch(0.15 0.01 70)",
        sidebarRing: "oklch(0.65 0.2 55)",
        chart1: "oklch(0.65 0.2 55)",
        chart2: "oklch(0.55 0.15 155)",
        chart3: "oklch(0.60 0.14 280)",
        chart4: "oklch(0.70 0.16 90)",
        chart5: "oklch(0.50 0.12 20)",
        accentGradient: createGradient([
          "oklch(0.65 0.2 55)",
          "oklch(0.76 0.14 70)",
          "oklch(0.88 0.035 55)",
        ]),
        interactiveGradient: createGradient([
          "oklch(0.65 0.2 55)",
          "oklch(0.65 0.2 55)",
        ]),
      },
      dark: {
        surfaceHue: "55",
        primary: "oklch(0.73 0.19 55)",
        primaryForeground: "oklch(0.15 0.01 70)",
        ring: "oklch(0.73 0.19 55)",
        destructive: "oklch(0.60 0.22 27)",
        success: "oklch(0.68 0.17 150)",
        warning: "oklch(0.80 0.16 85)",
        info: "oklch(0.65 0.15 245)",
        highlight: "oklch(0.68 0.17 300)",
        accent: "oklch(0.27 0.02 70)",
        accentForeground: "oklch(0.93 0.005 70)",
        sidebarPrimary: "oklch(0.73 0.19 55)",
        sidebarPrimaryForeground: "oklch(0.15 0.01 70)",
        sidebarAccent: "oklch(0.22 0.02 70)",
        sidebarAccentForeground: "oklch(0.93 0.005 70)",
        sidebarRing: "oklch(0.73 0.19 55)",
        chart1: "oklch(0.73 0.19 55)",
        chart2: "oklch(0.60 0.15 155)",
        chart3: "oklch(0.65 0.14 280)",
        chart4: "oklch(0.72 0.16 90)",
        chart5: "oklch(0.55 0.12 20)",
        accentGradient: createGradient([
          "oklch(0.78 0.12 68)",
          "oklch(0.73 0.19 55)",
          "oklch(0.58 0.11 46)",
        ]),
        interactiveGradient: createGradient([
          "oklch(0.73 0.19 55)",
          "oklch(0.73 0.19 55)",
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
        surfaceHue: "235",
        primary: "oklch(0.66 0.15 235)",
        primaryForeground: "oklch(0.985 0.003 70)",
        ring: "oklch(0.66 0.15 235)",
        destructive: createStateTokens(235).light.destructive,
        success: createStateTokens(235).light.success,
        warning: createStateTokens(235).light.warning,
        info: createStateTokens(235).light.info,
        highlight: createStateTokens(235).light.highlight,
        accent: "oklch(0.92 0.03 235)",
        accentForeground: "oklch(0.2 0.015 235)",
        sidebarPrimary: "oklch(0.66 0.15 235)",
        sidebarPrimaryForeground: "oklch(0.985 0.003 70)",
        sidebarAccent: "oklch(0.9 0.04 235)",
        sidebarAccentForeground: "oklch(0.2 0.015 235)",
        sidebarRing: "oklch(0.66 0.15 235)",
        chart1: "oklch(0.66 0.15 235)",
        chart2: createStateTokens(235).light.chart2,
        chart3: createStateTokens(235).light.chart3,
        chart4: createStateTokens(235).light.chart4,
        chart5: createStateTokens(235).light.chart5,
        accentGradient: createGradient([
          "#5BCEFA",
          "#F5A9B8",
          "#FFFFFF",
          "#F5A9B8",
          "#5BCEFA",
        ]),
        interactiveGradient: createDirectionalGradient([
          "oklch(0.62 0.15 240) 0%",
          "oklch(0.84 0.025 95) 52%",
          "oklch(0.59 0.12 354) 100%",
        ]),
      },
      dark: {
        surfaceHue: "235",
        primary: "oklch(0.75 0.13 235)",
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: "oklch(0.75 0.13 235)",
        destructive: createStateTokens(235).dark.destructive,
        success: createStateTokens(235).dark.success,
        warning: createStateTokens(235).dark.warning,
        info: createStateTokens(235).dark.info,
        highlight: createStateTokens(235).dark.highlight,
        accent: "oklch(0.31 0.04 235)",
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: "oklch(0.75 0.13 235)",
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: "oklch(0.28 0.045 235)",
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: "oklch(0.75 0.13 235)",
        chart1: "oklch(0.75 0.13 235)",
        chart2: createStateTokens(235).dark.chart2,
        chart3: createStateTokens(235).dark.chart3,
        chart4: createStateTokens(235).dark.chart4,
        chart5: createStateTokens(235).dark.chart5,
        accentGradient: createGradient([
          "#5BCEFA",
          "#F5A9B8",
          "#FFFFFF",
          "#F5A9B8",
          "#5BCEFA",
        ]),
        interactiveGradient: createDirectionalGradient([
          "oklch(0.76 0.11 238) 0%",
          "oklch(0.9 0.02 95) 50%",
          "oklch(0.72 0.09 352) 100%",
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
        surfaceHue: "285",
        primary: "oklch(0.62 0.17 285)",
        primaryForeground: "oklch(0.985 0.003 70)",
        ring: "oklch(0.62 0.17 285)",
        destructive: createStateTokens(285).light.destructive,
        success: createStateTokens(285).light.success,
        warning: createStateTokens(285).light.warning,
        info: createStateTokens(285).light.info,
        highlight: createStateTokens(285).light.highlight,
        accent: "oklch(0.91 0.035 285)",
        accentForeground: "oklch(0.21 0.02 285)",
        sidebarPrimary: "oklch(0.62 0.17 285)",
        sidebarPrimaryForeground: "oklch(0.985 0.003 70)",
        sidebarAccent: "oklch(0.89 0.045 285)",
        sidebarAccentForeground: "oklch(0.21 0.02 285)",
        sidebarRing: "oklch(0.62 0.17 285)",
        chart1: "oklch(0.62 0.17 285)",
        chart2: createStateTokens(285).light.chart2,
        chart3: createStateTokens(285).light.chart3,
        chart4: createStateTokens(285).light.chart4,
        chart5: createStateTokens(285).light.chart5,
        accentGradient: createGradient([
          "#E40303",
          "#FF8C00",
          "#FFED00",
          "#008026",
          "#24408E",
          "#732982",
        ]),
        interactiveGradient: createDirectionalGradient([
          "oklch(0.57 0.18 28) 0%",
          "oklch(0.6 0.12 150) 48%",
          "oklch(0.54 0.16 300) 100%",
        ]),
      },
      dark: {
        surfaceHue: "285",
        primary: "oklch(0.72 0.15 285)",
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: "oklch(0.72 0.15 285)",
        destructive: createStateTokens(285).dark.destructive,
        success: createStateTokens(285).dark.success,
        warning: createStateTokens(285).dark.warning,
        info: createStateTokens(285).dark.info,
        highlight: createStateTokens(285).dark.highlight,
        accent: "oklch(0.3 0.05 285)",
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: "oklch(0.72 0.15 285)",
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: "oklch(0.27 0.05 285)",
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: "oklch(0.72 0.15 285)",
        chart1: "oklch(0.72 0.15 285)",
        chart2: createStateTokens(285).dark.chart2,
        chart3: createStateTokens(285).dark.chart3,
        chart4: createStateTokens(285).dark.chart4,
        chart5: createStateTokens(285).dark.chart5,
        accentGradient: createGradient([
          "#E40303",
          "#FF8C00",
          "#FFED00",
          "#008026",
          "#24408E",
          "#732982",
        ]),
        interactiveGradient: createDirectionalGradient([
          "oklch(0.72 0.13 28) 0%",
          "oklch(0.78 0.1 150) 48%",
          "oklch(0.69 0.11 300) 100%",
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
        surfaceHue: "18",
        primary: "oklch(0.64 0.18 18)",
        primaryForeground: "oklch(0.985 0.003 70)",
        ring: "oklch(0.64 0.18 18)",
        destructive: createStateTokens(18).light.destructive,
        success: createStateTokens(18).light.success,
        warning: createStateTokens(18).light.warning,
        info: createStateTokens(18).light.info,
        highlight: createStateTokens(18).light.highlight,
        accent: "oklch(0.92 0.035 18)",
        accentForeground: "oklch(0.21 0.02 18)",
        sidebarPrimary: "oklch(0.64 0.18 18)",
        sidebarPrimaryForeground: "oklch(0.985 0.003 70)",
        sidebarAccent: "oklch(0.9 0.045 18)",
        sidebarAccentForeground: "oklch(0.21 0.02 18)",
        sidebarRing: "oklch(0.64 0.18 18)",
        chart1: "oklch(0.64 0.18 18)",
        chart2: createStateTokens(18).light.chart2,
        chart3: createStateTokens(18).light.chart3,
        chart4: createStateTokens(18).light.chart4,
        chart5: createStateTokens(18).light.chart5,
        accentGradient: createGradient([
          "#D52D00",
          "#EF7627",
          "#FF9A56",
          "#FFFFFF",
          "#D362A4",
          "#B55690",
          "#A30262",
        ]),
        interactiveGradient: createDirectionalGradient([
          "oklch(0.61 0.17 34) 0%",
          "oklch(0.82 0.03 75) 52%",
          "oklch(0.57 0.14 344) 100%",
        ]),
      },
      dark: {
        surfaceHue: "18",
        primary: "oklch(0.73 0.16 18)",
        primaryForeground: "oklch(0.16 0.01 70)",
        ring: "oklch(0.73 0.16 18)",
        destructive: createStateTokens(18).dark.destructive,
        success: createStateTokens(18).dark.success,
        warning: createStateTokens(18).dark.warning,
        info: createStateTokens(18).dark.info,
        highlight: createStateTokens(18).dark.highlight,
        accent: "oklch(0.31 0.05 18)",
        accentForeground: "oklch(0.94 0.005 70)",
        sidebarPrimary: "oklch(0.73 0.16 18)",
        sidebarPrimaryForeground: "oklch(0.16 0.01 70)",
        sidebarAccent: "oklch(0.28 0.05 18)",
        sidebarAccentForeground: "oklch(0.94 0.005 70)",
        sidebarRing: "oklch(0.73 0.16 18)",
        chart1: "oklch(0.73 0.16 18)",
        chart2: createStateTokens(18).dark.chart2,
        chart3: createStateTokens(18).dark.chart3,
        chart4: createStateTokens(18).dark.chart4,
        chart5: createStateTokens(18).dark.chart5,
        accentGradient: createGradient([
          "#D52D00",
          "#EF7627",
          "#FF9A56",
          "#FFFFFF",
          "#D362A4",
          "#B55690",
          "#A30262",
        ]),
        interactiveGradient: createDirectionalGradient([
          "oklch(0.75 0.13 30) 0%",
          "oklch(0.89 0.02 80) 50%",
          "oklch(0.71 0.1 344) 100%",
        ]),
      },
    },
  },
};

export const ACCENT_PRESET_LIST = ACCENT_PRESET_IDS.map(
  (presetId) => ACCENT_PRESETS[presetId],
);

const ACCENT_TOKEN_VARIABLES: Record<keyof AccentThemeTokens, string> = {
  surfaceHue: "--surface-hue",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  ring: "--ring",
  destructive: "--destructive",
  success: "--success",
  warning: "--warning",
  info: "--info",
  highlight: "--highlight",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarRing: "--sidebar-ring",
  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",
  accentGradient: "--accent-gradient",
  interactiveGradient: "--interactive-gradient",
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
