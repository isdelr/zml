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
          // Add extra padding if the music player is active.
          currentTrackIndex !== null && "pb-56 md:pb-20",
          // Add padding for the mobile top bar.
          "pt-16 md:pt-0"
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
