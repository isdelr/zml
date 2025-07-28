// components/layout/PageLayout.tsx
"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect } from "react";
import { Sidebar } from "../Sidebar";
import { NowPlayingView } from "../NowPlayingView";
import { usePathname } from "next/navigation";
import { InstallPWABanner } from "../InstallPWABanner"; // Import the new banner

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
        )}
      >
        {children}
      </div>
      <InstallPWABanner /> {/* Add the banner here */}
      <NowPlayingView />
    </div>
  );
}