// components/InstallPWABanner.tsx
"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "./ui/button";
import { Download, X } from "lucide-react";
import { Card } from "./ui/card";

export function InstallPWABanner() {
  const { isBannerVisible, handleInstallClick, handleDismissClick } = usePWAInstall();

  if (!isBannerVisible) {
    return null;
  }

  return (
    <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 p-2 animate-in slide-in-from-bottom-8 duration-500">
      <Card className="flex items-center p-3 bg-card/95 backdrop-blur-sm">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <Download className="size-8 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">Install ZML App</p>
              <p className="text-xs text-muted-foreground">
                Add to home screen for a better experience.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <Button size="sm" onClick={handleInstallClick}>
            Install
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleDismissClick}
          >
            <X className="size-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}