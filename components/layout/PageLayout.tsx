// components/layout/PageLayout.tsx
"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect } from "react";
import { Sidebar } from "../Sidebar";
import { NowPlayingView } from "../NowPlayingView";
import { usePathname } from "next/navigation";
import { InstallPWABanner } from "../InstallPWABanner";
import { MobileTopBar } from "../MobileTopBar";
import { NonBlockingErrorBoundary } from "../NonBlockingErrorBoundary";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );
  const { actions } = useMusicPlayerStore();
  const pathname = usePathname();

  useEffect(() => {
    actions.closeContextView();
  }, [pathname, actions]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          // Base padding for the bottom navbar on mobile.
          "pb-16 md:pb-0",
          // Add extra padding if the music player is active.
          currentTrackIndex !== null && "pb-56 md:pb-20",
          // Add padding for the new top bar on mobile
          "pt-16 md:pt-0" // Add top padding for mobile, remove for desktop
        )}
      >
        <MobileTopBar />
        {children}
      </div>
      <InstallPWABanner />
      <NonBlockingErrorBoundary boundaryName="NowPlayingView" resetKey={pathname}>
        <NowPlayingView />
      </NonBlockingErrorBoundary>
    </div>
  );
}
