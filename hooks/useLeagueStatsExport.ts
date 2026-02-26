"use client";

import { type RefObject, useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";

type UseLeagueStatsExportArgs = {
  enabled: boolean;
};

export function useLeagueStatsExport({ enabled }: UseLeagueStatsExportArgs): {
  exportRef: RefObject<HTMLDivElement | null>;
  isExporting: boolean;
  onExport: () => Promise<void>;
} {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const onExport = useCallback(async () => {
    if (!enabled || !exportRef.current) return;

    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const dataUrl = await toPng(exportRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
        cacheBust: true,
        skipAutoScale: true,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      });

      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      anchor.download = `league-awards-${timestamp}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export image. Please try again or check the console for details.");
    } finally {
      setIsExporting(false);
    }
  }, [enabled]);

  return { exportRef, isExporting, onExport };
}
