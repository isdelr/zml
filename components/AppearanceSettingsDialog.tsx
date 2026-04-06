"use client";

import { useMemo } from "react";
import { Monitor, Moon, Settings2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  ACCENT_PRESET_LIST,
  ACCENT_PRESETS,
  getAccentPreviewBackground,
  type AccentPreset,
} from "@/lib/theme/accent-theme";
import { useAccentTheme } from "@/components/providers/AccentThemeProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function AccentPresetSwatch({ preset }: { preset: AccentPreset }) {
  if (preset.kind === "pride") {
    return (
      <div
        className="h-3 w-full rounded-full border border-border/70 shadow-sm"
        style={{ backgroundImage: getAccentPreviewBackground(preset) }}
      />
    );
  }

  return (
    <div className="flex w-full gap-1">
      {preset.previewStops.map((colorStop) => (
        <span
          key={`${preset.id}-${colorStop}`}
          className="h-3 flex-1 rounded-full border border-border/70 shadow-sm"
          style={{ backgroundColor: colorStop }}
        />
      ))}
    </div>
  );
}

export function AppearanceSettingsDialog({
  className,
}: {
  className?: string;
}) {
  const { accentTheme, setAccentTheme } = useAccentTheme();
  const { setTheme, theme } = useTheme();
  const selectedTheme = theme ?? "system";
  const activePreset = useMemo(
    () => ACCENT_PRESETS[accentTheme],
    [accentTheme],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label="Open appearance settings"
        >
          <Settings2 className="size-5" />
          <span className="sr-only">Open appearance settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>
            Theme mode and accent presets are stored on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Theme</h3>
              <p className="text-sm text-muted-foreground">
                Choose how the app handles light and dark surfaces.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedTheme === option.value;

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className="justify-start gap-3"
                    onClick={() => setTheme(option.value)}
                  >
                    <Icon className="size-4" />
                    <span>{option.label}</span>
                  </Button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Accent</h3>
              <p className="text-sm text-muted-foreground">
                Interactive accents stay accessible while pride presets use
                gradients for decorative previews.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ACCENT_PRESET_LIST.map((preset) => {
                const isActive = preset.id === accentTheme;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setAccentTheme(preset.id)}
                    className={cn(
                      "rounded-xl border bg-card p-4 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive && "border-primary bg-accent/40 shadow-sm",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{preset.label}</span>
                          {isActive ? <Badge>Active</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <AccentPresetSwatch preset={preset} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Live preview</h3>
              <p className="text-sm text-muted-foreground">
                Current preset: {activePreset.label}
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div
                className="mb-4 h-2 rounded-full"
                style={{
                  backgroundImage: "var(--accent-gradient)",
                }}
              />

              <div className="grid gap-3 sm:grid-cols-4">
                <Button type="button">Primary</Button>
                <Button type="button" variant="ghost" className="border">
                  Ghost
                </Button>
                <div className="inline-flex items-center justify-center rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                  Selected chip
                </div>
                <button
                  type="button"
                  className="rounded-xl border bg-background px-3 py-2 text-sm font-medium shadow-sm outline-none ring-2 ring-ring ring-offset-2 ring-offset-background"
                >
                  Focus ring
                </button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
